import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_CONFIG } from './config';
import { TABLES, emptyDb, type Change, type Store } from './store';
import type { AnyRow, Config, DB, Member, Row, Table } from './types';

interface Toast {
  id: number;
  text: string;
}

interface DataApi {
  db: DB;
  config: Config;
  ready: boolean;
  mode: Store['mode'];
  me: string;
  myEmail: string;
  setMe?: (name: string) => void;
  signOut?: () => void;
  save<T extends Table>(table: T, row: Row<T>): void;
  saveMany(table: Table, rows: AnyRow[]): Promise<void>;
  remove(table: Table, id: string): void;
  saveConfig(config: Config): Promise<void>;
  syncAccess(team: Member[]): Promise<void>;
  importDb(db: DB): Promise<void>;
  toast(text: string): void;
}

const Ctx = createContext<DataApi | null>(null);

export const errText = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : 'Unknown error';

const stampNow = <T extends AnyRow>(r: T): T => ({ ...r, updated_at: new Date().toISOString() });

function apply(db: DB, c: Change): DB {
  if (c.kind === 'reload' || c.kind === 'config') return db;
  const list = db[c.table] as AnyRow[];
  if (c.kind === 'delete') return { ...db, [c.table]: list.filter((r) => r.id !== c.id) };
  const exists = list.some((r) => r.id === c.row.id);
  return { ...db, [c.table]: exists ? list.map((r) => (r.id === c.row.id ? c.row : r)) : [...list, c.row] };
}

interface Props {
  store: Store;
  /** Fallback name; the team entry matching email wins. */
  me: string;
  email?: string;
  setMe?: (name: string) => void;
  signOut?: () => void;
  children: ReactNode;
}

export function DataProvider({ store, me: meProp, email = '', setMe, signOut, children }: Props) {
  const [db, setDb] = useState<DB>(emptyDb);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [data, cfg] = await Promise.all([store.load(), store.loadConfig()]);
      setDb(data);
      setConfig(cfg);
    } catch (e) {
      toast(`Could not load data. ${errText(e)}`);
    } finally {
      setReady(true);
    }
  }, [store, toast]);

  useEffect(() => {
    void reload();
    return store.subscribe((c) => {
      if (c.kind === 'reload') void reload();
      else if (c.kind === 'config') setConfig(c.config);
      else setDb((d) => apply(d, c));
    });
  }, [store, reload]);

  const save = useCallback(
    <T extends Table>(table: T, row: Row<T>) => {
      const stamped = stampNow(row as AnyRow);
      setDb((d) => apply(d, { table, kind: 'upsert', row: stamped }));
      store.upsert(table, [stamped]).catch((e) => {
        toast(`Not saved. ${errText(e)}`);
        void reload();
      });
    },
    [store, toast, reload],
  );

  const saveMany = useCallback(
    async (table: Table, rows: AnyRow[]) => {
      if (!rows.length) return;
      const stamped = rows.map(stampNow);
      setDb((d) => stamped.reduce((acc, row) => apply(acc, { table, kind: 'upsert', row }), d));
      await store.upsert(table, stamped);
    },
    [store],
  );

  const remove = useCallback(
    (table: Table, id: string) => {
      setDb((d) => apply(d, { table, kind: 'delete', id }));
      store.remove(table, id).catch((e) => {
        toast(`Not deleted. ${errText(e)}`);
        void reload();
      });
    },
    [store, toast, reload],
  );

  const saveConfig = useCallback(
    async (next: Config) => {
      setConfig(next);
      await store.saveConfig(next);
    },
    [store],
  );

  const syncAccess = useCallback((team: Member[]) => store.syncAccess(team, email), [store, email]);

  const importDb = useCallback(
    async (data: DB) => {
      try {
        for (const t of TABLES) if (data[t]?.length) await store.upsert(t, data[t] as AnyRow[]);
        await reload();
        toast('Data imported');
      } catch (e) {
        toast(`Import failed. ${errText(e)}`);
      }
    },
    [store, reload, toast],
  );

  const me = (email && config.team.find((m) => m.email.toLowerCase() === email.toLowerCase())?.name) || meProp;

  const api = useMemo<DataApi>(
    () => ({ db, config, ready, mode: store.mode, me, myEmail: email, setMe, signOut, save, saveMany, remove, saveConfig, syncAccess, importDb, toast }),
    [db, config, ready, store.mode, me, email, setMe, signOut, save, saveMany, remove, saveConfig, syncAccess, importDb, toast],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useData(): DataApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
