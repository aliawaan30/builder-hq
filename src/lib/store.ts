import { DEFAULT_CONFIG, PALETTE, normalizeConfig } from './config';
import { uid } from './factory';
import { supabase } from './supabase';
import type { AnyRow, Client, Config, DB, Meeting, Member, Table, Task } from './types';

export type Change =
  | { table: Table; kind: 'upsert'; row: AnyRow }
  | { table: Table; kind: 'delete'; id: string }
  | { kind: 'config'; config: Config }
  | { kind: 'reload' };

export interface Store {
  mode: 'local' | 'cloud';
  load(): Promise<DB>;
  loadConfig(): Promise<Config>;
  saveConfig(config: Config): Promise<void>;
  /** Cloud only: mirror the team into the access list. Never removes keepEmail. */
  syncAccess(team: Member[], keepEmail: string): Promise<void>;
  upsert(table: Table, rows: AnyRow[]): Promise<void>;
  remove(table: Table, id: string): Promise<void>;
  subscribe(cb: (c: Change) => void): () => void;
}

export const TABLES: Table[] = ['tasks', 'meetings', 'clients'];

/** Rows saved before a field existed get its default. */
const fixTask = (t: Task): Task => ({ ...t, checklist: Array.isArray(t.checklist) ? t.checklist : [] });
export const emptyDb = (): DB => ({ tasks: [], meetings: [], clients: [] });

const KEY = 'builder-hq.db.v1';
const CONFIG_KEY = 'builder-hq.config.v1';

export function localStore(): Store {
  const read = (): DB => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyDb();
      const db = { ...emptyDb(), ...(JSON.parse(raw) as Partial<DB>) };
      return { ...db, tasks: db.tasks.map(fixTask) };
    } catch {
      return emptyDb();
    }
  };
  const write = (db: DB) => localStorage.setItem(KEY, JSON.stringify(db));

  return {
    mode: 'local',
    async load() {
      return read();
    },
    async loadConfig() {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        return raw ? normalizeConfig(JSON.parse(raw)) : structuredClone(DEFAULT_CONFIG);
      } catch {
        return structuredClone(DEFAULT_CONFIG);
      }
    },
    async saveConfig(config) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    },
    async syncAccess() {
      /* no access list in local mode */
    },
    async upsert(table, rows) {
      const db = read();
      const list = db[table] as AnyRow[];
      for (const r of rows) {
        const i = list.findIndex((x) => x.id === r.id);
        if (i >= 0) list[i] = r;
        else list.push(r);
      }
      write(db);
    },
    async remove(table, id) {
      const db = read();
      const list = db[table] as AnyRow[];
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) list.splice(i, 1);
      write(db);
    },
    subscribe(cb) {
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY || e.key === CONFIG_KEY) cb({ kind: 'reload' });
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}

/** Fill missing emails from the access list, and add anyone on it who is missing. */
function withAccess(config: Config, rows: { email: string; name: string }[]): Config {
  const team = config.team.map((m) =>
    m.email ? m : { ...m, email: rows.find((r) => r.name.toLowerCase() === m.name.toLowerCase())?.email ?? '' },
  );
  for (const r of rows) {
    if (!team.some((m) => m.email.toLowerCase() === r.email.toLowerCase())) {
      team.push({ id: uid(), name: r.name, email: r.email, tz: 'UTC', place: '', start: 9, end: 17, color: PALETTE[team.length % PALETTE.length] });
    }
  }
  return { ...config, team };
}

export function cloudStore(): Store {
  const sb = supabase;
  if (!sb) throw new Error('Supabase is not configured');

  return {
    mode: 'cloud',
    async load() {
      const [t, m, c] = await Promise.all([
        sb.from('tasks').select('*'),
        sb.from('meetings').select('*'),
        sb.from('clients').select('*'),
      ]);
      const failed = [t, m, c].find((r) => r.error);
      if (failed?.error) throw failed.error;
      return {
        tasks: ((t.data ?? []) as Task[]).map(fixTask),
        meetings: (m.data ?? []) as Meeting[],
        clients: ((c.data ?? []) as Client[]).map((x) => ({ ...x, setup_value: Number(x.setup_value), monthly: Number(x.monthly) })),
      };
    },
    async loadConfig() {
      const [cfg, members] = await Promise.all([
        sb.from('app_config').select('data').eq('id', 1).maybeSingle(),
        sb.from('team_members').select('email, name'),
      ]);
      if (cfg.error) throw cfg.error;
      if (members.error) throw members.error;
      const base = normalizeConfig((cfg.data as { data?: unknown } | null)?.data);
      return withAccess(base, (members.data ?? []) as { email: string; name: string }[]);
    },
    async saveConfig(config) {
      const { error } = await sb.from('app_config').upsert({ id: 1, data: config, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    async syncAccess(team, keepEmail) {
      const rows = team.filter((m) => m.email).map((m) => ({ email: m.email.toLowerCase(), name: m.name }));
      if (rows.length) {
        const { error } = await sb.from('team_members').upsert(rows, { onConflict: 'email' });
        if (error) throw error;
      }
      const { data, error } = await sb.from('team_members').select('email');
      if (error) throw error;
      const keep = new Set([...rows.map((r) => r.email), keepEmail.toLowerCase()]);
      const gone = ((data ?? []) as { email: string }[]).map((r) => r.email).filter((e) => !keep.has(e.toLowerCase()));
      if (gone.length) {
        const del = await sb.from('team_members').delete().in('email', gone);
        if (del.error) throw del.error;
      }
    },
    async upsert(table, rows) {
      const { error } = await sb.from(table).upsert(rows);
      if (error) throw error;
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    subscribe(cb) {
      const channel = sb.channel('builder-hq-sync');
      for (const table of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id;
            if (id) cb({ table, kind: 'delete', id });
          } else {
            cb({ table, kind: 'upsert', row: table === 'tasks' ? fixTask(p.new as Task) : (p.new as AnyRow) });
          }
        });
      }
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, (p) => {
        if (p.eventType !== 'DELETE') cb({ kind: 'config', config: normalizeConfig((p.new as { data?: unknown }).data) });
      });
      channel.subscribe();
      return () => {
        void sb.removeChannel(channel);
      };
    },
  };
}
