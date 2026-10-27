import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui';
import { OFFERS, PALETTE } from '../lib/config';
import { errText, useData } from '../lib/data';
import { uid } from '../lib/factory';
import { fmtMin } from '../lib/time';
import type { Client, Config, Meeting, Member, Offer, Stage, Task, WorkstreamDef } from '../lib/types';

/** Where items of a removed entry go: removed id to target id. */
interface Moves {
  team: Record<string, string>;
  ws: Record<string, string>;
  stage: Record<string, string>;
}

const noMoves = (): Moves => ({ team: {}, ws: {}, stage: {} });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOURS = Array.from({ length: 25 }, (_, h) => h);

const ZONES: string[] = (() => {
  try {
    return ['UTC', ...Intl.supportedValuesOf('timeZone')];
  } catch {
    return ['UTC', 'Asia/Karachi', 'Australia/Brisbane', 'Australia/Sydney', 'America/New_York', 'America/Los_Angeles', 'Europe/London'];
  }
})();

/** Follow a chain of moves to an id that still exists. */
function resolve(map: Record<string, string>, id: string, valid: Set<string>, fallback: string): string {
  let cur = id;
  for (let i = 0; i < 20 && map[cur]; i++) cur = map[cur];
  return valid.has(cur) ? cur : fallback;
}

export function Setup() {
  const { config, db, mode, me, myEmail, setMe, saveConfig, saveMany, syncAccess, toast } = useData();
  const [draft, setDraft] = useState<Config>(config);
  const [moves, setMoves] = useState<Moves>(noMoves);
  const [offer, setOffer] = useState<Offer>('business');
  const [busy, setBusy] = useState(false);
  const base = useRef(config);

  // Take remote changes unless there are local edits.
  useEffect(() => {
    setDraft((d) => (same(d, base.current) ? config : d));
    base.current = config;
  }, [config]);

  const dirty = !same(draft, config);
  const savedSelf = config.team.find((m) =>
    mode === 'cloud' ? !!myEmail && m.email.toLowerCase() === myEmail.toLowerCase() : m.name === me,
  );
  const isSelf = (m: Member) => m.id === savedSelf?.id;

  const usage = useMemo(() => {
    const open = db.tasks.filter((t) => t.status !== 'done');
    return {
      member: (name: string) => db.tasks.filter((t) => t.owner === name).length + db.clients.filter((c) => c.csm === name).length,
      ws: (id: string) => open.filter((t) => t.workstream === id).length + db.tasks.filter((t) => t.status === 'done' && t.workstream === id).length,
      openWs: (id: string) => open.filter((t) => t.workstream === id).length,
      stage: (o: Offer, id: string) => db.clients.filter((c) => c.offer === o && c.stage === id).length,
    };
  }, [db]);

  const patch = <K extends keyof Config>(key: K, value: Config[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Team
  const setMember = (id: string, p: Partial<Member>) => patch('team', draft.team.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const addMember = () =>
    patch('team', [
      ...draft.team,
      { id: uid(), name: '', email: '', tz: Intl.DateTimeFormat().resolvedOptions().timeZone, place: '', start: 9, end: 17, color: PALETTE[draft.team.length % PALETTE.length] },
    ]);
  const removeMember = (id: string, moveTo: string | null) => {
    patch('team', draft.team.filter((m) => m.id !== id));
    if (moveTo) setMoves((mv) => ({ ...mv, team: { ...mv.team, [id]: moveTo } }));
  };

  // Workstreams
  const setWs = (id: string, p: Partial<WorkstreamDef>) => patch('workstreams', draft.workstreams.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const addWs = () => patch('workstreams', [...draft.workstreams, { id: uid(), label: '', color: PALETTE[draft.workstreams.length % PALETTE.length] }]);
  const removeWs = (id: string, moveTo: string | null) => {
    patch('workstreams', draft.workstreams.filter((w) => w.id !== id));
    if (moveTo) setMoves((mv) => ({ ...mv, ws: { ...mv.ws, [id]: moveTo } }));
  };

  // Stages
  const stages = draft.stages[offer];
  const setStages = (list: Stage[]) => patch('stages', { ...draft.stages, [offer]: list });
  const setStage = (id: string, p: Partial<Stage>) => setStages(stages.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const moveStage = (i: number, dir: -1 | 1) => {
    const next = [...stages];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setStages(next);
  };
  const removeStage = (id: string, moveTo: string | null) => {
    setStages(stages.filter((s) => s.id !== id));
    if (moveTo) setMoves((mv) => ({ ...mv, stage: { ...mv.stage, [id]: moveTo } }));
  };

  const discard = () => {
    setDraft(config);
    setMoves(noMoves());
  };

  const validate = (): string | null => {
    const names = draft.team.map((m) => m.name.trim().toLowerCase());
    if (names.some((n) => !n)) return 'Every team member needs a name.';
    if (new Set(names).size !== names.length) return 'Two team members have the same name.';
    if (draft.team.some((m) => m.start >= m.end)) return 'Working hours must end after they start.';
    const emails = draft.team.map((m) => m.email.trim().toLowerCase()).filter(Boolean);
    if (emails.some((e) => !EMAIL.test(e))) return 'One of the emails is not valid.';
    if (new Set(emails).size !== emails.length) return 'Two team members have the same email.';
    if (mode === 'cloud' && draft.team.some((m) => !m.email.trim())) return 'Every team member needs an email to sign in.';
    if (draft.workstreams.some((w) => !w.label.trim())) return 'Every workstream needs a name.';
    for (const o of OFFERS) if (draft.stages[o.id].some((s) => !s.label.trim())) return `Every ${o.label} stage needs a name.`;
    return null;
  };

  const commit = async () => {
    const problem = validate();
    if (problem) return toast(problem);
    setBusy(true);
    const next: Config = {
      team: draft.team.map((m) => ({ ...m, name: m.name.trim(), email: m.email.trim().toLowerCase(), place: m.place.trim() })),
      workstreams: draft.workstreams.map((w) => ({ ...w, label: w.label.trim() })),
      stages: Object.fromEntries(OFFERS.map((o) => [o.id, draft.stages[o.id].map((s) => ({ ...s, label: s.label.trim() }))])) as Config['stages'],
    };

    // Old name to new name, following renames and removals.
    const ids = new Set(next.team.map((m) => m.id));
    const nameById = new Map(next.team.map((m) => [m.id, m.name]));
    const newName = (old: string): string => {
      const prev = config.team.find((m) => m.name === old);
      if (!prev) return old;
      return nameById.get(resolve(moves.team, prev.id, ids, '')) ?? old;
    };
    const wsIds = new Set(next.workstreams.map((w) => w.id));
    const wsOf = (id: string) => (wsIds.has(id) ? id : resolve(moves.ws, id, wsIds, next.workstreams[0].id));
    const stageOf = (o: Offer, id: string) => {
      const valid = new Set(next.stages[o].map((s) => s.id));
      return valid.has(id) ? id : resolve(moves.stage, id, valid, next.stages[o][0].id);
    };

    const tasks: Task[] = [];
    for (const t of db.tasks) {
      const owner = newName(t.owner);
      const workstream = wsOf(t.workstream);
      if (owner !== t.owner || workstream !== t.workstream) tasks.push({ ...t, owner, workstream });
    }
    const clients: Client[] = [];
    for (const c of db.clients) {
      const csm = newName(c.csm);
      const stage = stageOf(c.offer, c.stage);
      if (csm !== c.csm || stage !== c.stage) clients.push({ ...c, csm, stage });
    }
    const meetings: Meeting[] = [];
    for (const m of db.meetings) {
      const actions = m.actions.map((a) => ({ ...a, owner: newName(a.owner) }));
      if (!same(actions, m.actions)) meetings.push({ ...m, actions });
    }

    try {
      await saveConfig(next);
      await Promise.all([saveMany('tasks', tasks), saveMany('clients', clients), saveMany('meetings', meetings)]);
      if (mode === 'cloud') await syncAccess(next.team);
      if (setMe && savedSelf) {
        const renamed = nameById.get(savedSelf.id);
        if (renamed && renamed !== me) setMe(renamed);
      }
      setMoves(noMoves());
      const moved = tasks.length + clients.length + meetings.length;
      toast(moved ? `Setup saved. ${moved} items updated.` : 'Setup saved');
    } catch (e) {
      toast(`Not saved. ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page setup">
      <header className="page-head">
        <div>
          <h1>Setup</h1>
          <p className="sub">Team, workstreams and client stages. Changes apply for everyone when you save.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Team</h2>
            <p className="muted small">
              {mode === 'cloud' ? 'People listed here can sign in. Hours drive the overlap view on Today.' : 'Hours drive the overlap view on Today.'}
            </p>
          </div>
          <button type="button" className="btn" onClick={addMember}>
            <Icon name="plus" size={16} /> Add person
          </button>
        </div>
        <div className="members">
          {draft.team.map((m) => {
            const self = isSelf(m);
            const saved = config.team.find((x) => x.id === m.id);
            const used = saved ? usage.member(saved.name) : 0;
            return (
              <div key={m.id} className="member">
                <div className="member-top">
                  <input type="color" className="swatch" value={m.color} onChange={(e) => setMember(m.id, { color: e.target.value })} aria-label="Colour" />
                  <input className="member-name" value={m.name} onChange={(e) => setMember(m.id, { name: e.target.value })} placeholder="Name" aria-label="Name" />
                  {self && <span className="tag">You</span>}
                  <RemoveControl
                    disabled={self || draft.team.length === 1}
                    disabledReason={self ? 'You cannot remove yourself' : 'Keep at least one person'}
                    inUse={used}
                    noun="tasks and clients"
                    options={draft.team.filter((x) => x.id !== m.id).map((x) => ({ id: x.id, label: x.name || 'Unnamed' }))}
                    onRemove={(to) => removeMember(m.id, to)}
                  />
                </div>
                <div className="member-grid">
                  <label className="field">
                    <span className="field-label">Email</span>
                    <input type="email" value={m.email} readOnly={mode === 'cloud' && self} onChange={(e) => setMember(m.id, { email: e.target.value })} placeholder="name@company.com" />
                  </label>
                  <label className="field">
                    <span className="field-label">Place</span>
                    <input value={m.place} onChange={(e) => setMember(m.id, { place: e.target.value })} placeholder="Gold Coast" />
                  </label>
                  <label className="field">
                    <span className="field-label">Time zone</span>
                    <select value={m.tz} onChange={(e) => setMember(m.id, { tz: e.target.value })}>
                      {!ZONES.includes(m.tz) && <option>{m.tz}</option>}
                      {ZONES.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                  </label>
                  <div className="field">
                    <span className="field-label">Working hours</span>
                    <div className="hours">
                      <select value={m.start} onChange={(e) => setMember(m.id, { start: Number(e.target.value) })} aria-label="Start">
                        {HOURS.slice(0, 24).map((h) => (
                          <option key={h} value={h}>
                            {fmtMin(h * 60)}
                          </option>
                        ))}
                      </select>
                      <span className="muted">to</span>
                      <select value={m.end} onChange={(e) => setMember(m.id, { end: Number(e.target.value) })} aria-label="End">
                        {HOURS.slice(1).map((h) => (
                          <option key={h} value={h}>
                            {h === 24 ? 'midnight' : fmtMin(h * 60)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Workstreams</h2>
            <p className="muted small">The filters and colours on the board.</p>
          </div>
          <button type="button" className="btn" onClick={addWs}>
            <Icon name="plus" size={16} /> Add workstream
          </button>
        </div>
        <ul className="setlist">
          {draft.workstreams.map((w) => (
            <li key={w.id}>
              <input type="color" className="swatch" value={w.color} onChange={(e) => setWs(w.id, { color: e.target.value })} aria-label="Colour" />
              <input value={w.label} onChange={(e) => setWs(w.id, { label: e.target.value })} placeholder="Workstream name" aria-label="Workstream name" />
              <span className="muted small nowrap">{usage.openWs(w.id)} open</span>
              <RemoveControl
                disabled={draft.workstreams.length === 1}
                disabledReason="Keep at least one workstream"
                inUse={usage.ws(w.id)}
                noun="tasks"
                options={draft.workstreams.filter((x) => x.id !== w.id).map((x) => ({ id: x.id, label: x.label || 'Unnamed' }))}
                onRemove={(to) => removeWs(w.id, to)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Client stages</h2>
            <p className="muted small">Columns on the Clients page, in order. Paying stages count towards revenue. Inactive stages are left out of active counts.</p>
          </div>
          <button type="button" className="btn" onClick={() => setStages([...stages, { id: uid(), label: '', won: false, closed: false }])}>
            <Icon name="plus" size={16} /> Add stage
          </button>
        </div>
        <div className="tabs setup-tabs" role="tablist" aria-label="Offer">
          {OFFERS.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={offer === o.id} className={offer === o.id ? 'is-on' : ''} onClick={() => setOffer(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <ul className="setlist">
          {stages.map((s, i) => (
            <li key={s.id}>
              <span className="order">
                <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => moveStage(i, -1)}>
                  <Icon name="up" size={15} />
                </button>
                <button type="button" className="icon-btn" aria-label="Move down" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)}>
                  <Icon name="down" size={15} />
                </button>
              </span>
              <input value={s.label} onChange={(e) => setStage(s.id, { label: e.target.value })} placeholder="Stage name" aria-label="Stage name" />
              <label className="check">
                <input type="checkbox" checked={s.won} onChange={(e) => setStage(s.id, { won: e.target.checked })} /> Paying
              </label>
              <label className="check">
                <input type="checkbox" checked={s.closed} onChange={(e) => setStage(s.id, { closed: e.target.checked })} /> Inactive
              </label>
              <span className="muted small nowrap">{usage.stage(offer, s.id)} clients</span>
              <RemoveControl
                disabled={stages.length === 1}
                disabledReason="Keep at least one stage"
                inUse={usage.stage(offer, s.id)}
                noun="clients"
                options={stages.filter((x) => x.id !== s.id).map((x) => ({ id: x.id, label: x.label || 'Unnamed' }))}
                onRemove={(to) => removeStage(s.id, to)}
              />
            </li>
          ))}
        </ul>
      </section>

      {dirty && (
        <div className="savebar" role="region" aria-label="Unsaved changes">
          <span>You have unsaved changes.</span>
          <button type="button" className="btn btn-ghost" onClick={discard} disabled={busy}>
            Discard
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void commit()} disabled={busy}>
            {busy ? 'Saving' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}

interface RemoveProps {
  inUse: number;
  noun: string;
  options: { id: string; label: string }[];
  onRemove: (moveTo: string | null) => void;
  disabled?: boolean;
  disabledReason?: string;
}

/** Removes straight away when unused. Otherwise asks where existing items should go. */
function RemoveControl({ inUse, noun, options, onRemove, disabled, disabledReason }: RemoveProps) {
  const [asking, setAsking] = useState(false);
  const [target, setTarget] = useState(options[0]?.id ?? '');

  if (asking)
    return (
      <span className="move">
        <span className="small">
          Move {inUse} {noun} to
        </span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Move to">
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-small btn-danger" onClick={() => onRemove(target)}>
          Remove
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </span>
    );

  return (
    <button
      type="button"
      className="icon-btn remove"
      aria-label="Remove"
      title={disabled ? disabledReason : 'Remove'}
      disabled={disabled}
      onClick={() => (inUse > 0 ? setAsking(true) : onRemove(null))}
    >
      <Icon name="trash" size={16} />
    </button>
  );
}
