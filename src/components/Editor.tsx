import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { OFFERS, STATUSES } from '../lib/config';
import { useData } from '../lib/data';
import { uid } from '../lib/factory';
import { fmtDate } from '../lib/time';
import type { ActionItem, ChecklistItem, Client, Meeting, Member, Offer, Priority, Size, Task, TaskStatus } from '../lib/types';
import { useConfig } from '../lib/useConfig';
import { Field, Icon, Segmented } from './ui';

export type Editing =
  | { kind: 'task'; row: Task; isNew?: boolean; onSaved?: (t: Task) => void }
  | { kind: 'meeting'; row: Meeting; isNew?: boolean }
  | { kind: 'client'; row: Client; isNew?: boolean };

const EditorCtx = createContext<(e: Editing) => void>(() => undefined);
export const useEditor = () => useContext(EditorCtx);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const close = () => setEditing(null);
  return (
    <EditorCtx.Provider value={setEditing}>
      {children}
      {editing && (
        <Drawer key={editing.row.id} title={titleFor(editing)} onClose={close}>
          {editing.kind === 'task' && <TaskForm e={editing} onDone={close} />}
          {editing.kind === 'meeting' && <MeetingForm e={editing} onDone={close} />}
          {editing.kind === 'client' && <ClientForm e={editing} onDone={close} />}
        </Drawer>
      )}
    </EditorCtx.Provider>
  );
}

const titleFor = (e: Editing) => `${e.isNew ? 'New' : 'Edit'} ${e.kind}`;

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="drawer-wrap">
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Two step delete so nothing goes by accident. */
function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = window.setTimeout(() => setSure(false), 4000);
    return () => window.clearTimeout(t);
  }, [sure]);
  return (
    <button type="button" className={`btn btn-danger${sure ? ' is-armed' : ''}`} onClick={() => (sure ? onDelete() : setSure(true))}>
      {sure ? 'Click again to delete' : 'Delete'}
    </button>
  );
}

function FormShell({ onSubmit, onDelete, saveLabel, children }: { onSubmit: () => void; onDelete?: () => void; saveLabel: string; children: ReactNode }) {
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    onSubmit();
  };
  return (
    <form
      className="form"
      onSubmit={submit}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
          ev.preventDefault();
          onSubmit();
        }
      }}
    >
      <div className="form-body">{children}</div>
      <footer className="form-foot">
        {onDelete && <DeleteButton onDelete={onDelete} />}
        <span className="hint">Ctrl or Cmd plus Enter saves</span>
        <button type="submit" className="btn btn-primary">
          {saveLabel}
        </button>
      </footer>
    </form>
  );
}

/** Team names, plus the current value if that person was removed. */
function TeamOptions({ value }: { value: string }) {
  const { team } = useConfig();
  const names = team.map((m) => m.name);
  return (
    <>
      {value && !names.includes(value) && <option>{value}</option>}
      {names.map((n) => (
        <option key={n}>{n}</option>
      ))}
    </>
  );
}

function TaskForm({ e, onDone }: { e: Extract<Editing, { kind: 'task' }>; onDone: () => void }) {
  const { save, remove, toast, db } = useData();
  const { workstreams } = useConfig();
  const [t, setT] = useState<Task>(e.row);
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT((x) => ({ ...x, [k]: v }));
  const meeting = t.meeting_id ? db.meetings.find((m) => m.id === t.meeting_id) : undefined;

  /** Checklist changes on an existing task save straight away, like ticking a box on paper. */
  const commitChecklist = (checklist: ChecklistItem[]) => {
    setT((x) => ({ ...x, checklist }));
    if (e.isNew) return;
    const stored = db.tasks.find((x) => x.id === t.id);
    if (stored && JSON.stringify(stored.checklist) !== JSON.stringify(checklist)) save('tasks', { ...stored, checklist });
  };

  const submit = () => {
    if (!t.title.trim()) return toast('Add a title first');
    const row = { ...t, title: t.title.trim() };
    save('tasks', row);
    e.onSaved?.(row);
    toast(e.isNew ? 'Task added' : 'Task saved');
    onDone();
  };

  return (
    <FormShell saveLabel={e.isNew ? 'Add task' : 'Save task'} onSubmit={submit} onDelete={e.isNew ? undefined : () => (remove('tasks', t.id), onDone())}>
      <Field label="Title" wide>
        <input value={t.title} onChange={(ev) => set('title', ev.target.value)} placeholder="What needs to happen" />
      </Field>
      <Field label="Workstream">
        <select value={t.workstream} onChange={(ev) => set('workstream', ev.target.value)}>
          {workstreams.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select value={t.status} onChange={(ev) => set('status', ev.target.value as TaskStatus)}>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Owner">
        <select value={t.owner} onChange={(ev) => set('owner', ev.target.value)}>
          <TeamOptions value={t.owner} />
        </select>
      </Field>
      <Field label="Due">
        <input type="date" value={t.due ?? ''} onChange={(ev) => set('due', ev.target.value || null)} />
      </Field>
      <Segmented<Priority>
        label="Priority"
        value={t.priority}
        onChange={(v) => set('priority', v)}
        options={[
          { value: 1, label: 'P1' },
          { value: 2, label: 'P2' },
          { value: 3, label: 'P3' },
        ]}
      />
      <Segmented<Size>
        label="Size"
        value={t.size}
        onChange={(v) => set('size', v)}
        options={[
          { value: 'quick', label: 'Quick win' },
          { value: 'big', label: 'Bigger build' },
        ]}
      />
      <Checklist items={t.checklist} onDraft={(c) => set('checklist', c)} onCommit={commitChecklist} live={!e.isNew} />
      <Field label="Notes" wide>
        <textarea rows={5} value={t.notes} onChange={(ev) => set('notes', ev.target.value)} placeholder="Context, links, blockers" />
      </Field>
      {meeting && (
        <p className="form-note is-wide">
          From the {fmtDate(meeting.date)} meeting: {meeting.title}
        </p>
      )}
    </FormShell>
  );
}

interface ChecklistProps {
  items: ChecklistItem[];
  /** Local edit while typing. */
  onDraft: (items: ChecklistItem[]) => void;
  /** Finished change: tick, add, remove, or leaving a text field. */
  onCommit: (items: ChecklistItem[]) => void;
  live: boolean;
}

function Checklist({ items, onDraft, onCommit, live }: ChecklistProps) {
  const [text, setText] = useState('');
  const refs = useRef(new Map<string, HTMLInputElement>());
  const done = items.filter((i) => i.done).length;

  const add = () => {
    const value = text.trim();
    if (!value) return;
    onCommit([...items, { id: uid(), text: value, done: false }]);
    setText('');
  };

  const remove = (id: string) => onCommit(items.filter((i) => i.id !== id));

  const move = (i: number, dir: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onCommit(next);
  };

  return (
    <div className="field is-wide checklist">
      <div className="checklist-head">
        <span className="field-label">Checklist</span>
        {items.length > 0 && (
          <span className="muted small">
            {done} of {items.length} done{live ? ', saves as you go' : ''}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <div className="checklist-bar" aria-hidden="true">
          <span style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}
      <ul className="checklist-items">
        {items.map((item, i) => (
          <li key={item.id} className={item.done ? 'is-done' : ''}>
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`Done: ${item.text}`}
              onChange={() => onCommit(items.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))}
            />
            <input
              ref={(el) => (el ? refs.current.set(item.id, el) : refs.current.delete(item.id))}
              className="checklist-text"
              value={item.text}
              aria-label="Checklist item"
              onChange={(ev) => onDraft(items.map((x) => (x.id === item.id ? { ...x, text: ev.target.value } : x)))}
              onBlur={() => (item.text.trim() ? onCommit(items) : remove(item.id))}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' && !ev.metaKey && !ev.ctrlKey) {
                  ev.preventDefault();
                  ev.currentTarget.blur();
                }
                if (ev.key === 'Backspace' && !item.text) {
                  ev.preventDefault();
                  const prev = items[i - 1];
                  remove(item.id);
                  if (prev) window.setTimeout(() => refs.current.get(prev.id)?.focus(), 0);
                }
                if (ev.altKey && ev.key === 'ArrowUp' && i > 0) move(i, -1);
                if (ev.altKey && ev.key === 'ArrowDown' && i < items.length - 1) move(i, 1);
              }}
            />
            <button type="button" className="icon-btn" aria-label="Remove item" onClick={() => remove(item.id)}>
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <input
        className="checklist-add"
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        placeholder={items.length ? 'Add another item' : 'Add a checklist item, press Enter'}
        aria-label="Add checklist item"
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' && !ev.metaKey && !ev.ctrlKey) {
            ev.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

/** Actions are edited as lines like "Blake: send the calendar link". */
const actionsToText = (a: ActionItem[]) => a.map((x) => `${x.owner}: ${x.text}`).join('\n');
function textToActions(text: string, prev: ActionItem[], team: Member[]): ActionItem[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(/^([^:]{1,30}):\s*(.+)$/);
      const match = m ? team.find((p) => p.name.toLowerCase() === m[1].trim().toLowerCase()) : undefined;
      const named = !!match;
      const owner = match?.name ?? team[0].name;
      const body = named && m ? m[2].trim() : line;
      const old = prev.find((p) => p.text === body) ?? prev[i];
      return { id: old?.id ?? uid(), owner, text: body, task_id: old?.task_id ?? null };
    });
}

function MeetingForm({ e, onDone }: { e: Extract<Editing, { kind: 'meeting' }>; onDone: () => void }) {
  const { save, remove, toast } = useData();
  const { team } = useConfig();
  const [m, setM] = useState<Meeting>(e.row);
  const [decisions, setDecisions] = useState(e.row.decisions.join('\n'));
  const [actions, setActions] = useState(actionsToText(e.row.actions));
  const set = <K extends keyof Meeting>(k: K, v: Meeting[K]) => setM((x) => ({ ...x, [k]: v }));

  const submit = () => {
    if (!m.title.trim()) return toast('Add a title first');
    save('meetings', {
      ...m,
      title: m.title.trim(),
      decisions: decisions.split('\n').map((d) => d.trim()).filter(Boolean),
      actions: textToActions(actions, m.actions, team),
    });
    toast(e.isNew ? 'Meeting added' : 'Meeting saved');
    onDone();
  };

  return (
    <FormShell saveLabel={e.isNew ? 'Add meeting' : 'Save meeting'} onSubmit={submit} onDelete={e.isNew ? undefined : () => (remove('meetings', m.id), onDone())}>
      <Field label="Title" wide>
        <input value={m.title} onChange={(ev) => set('title', ev.target.value)} placeholder="Business owner offer call" />
      </Field>
      <Field label="Date">
        <input type="date" value={m.date} onChange={(ev) => set('date', ev.target.value)} required />
      </Field>
      <Field label="Recording link">
        <input type="url" value={m.recording} onChange={(ev) => set('recording', ev.target.value)} placeholder="https://fathom.video/..." />
      </Field>
      <Field label="Summary" wide>
        <textarea rows={4} value={m.summary} onChange={(ev) => set('summary', ev.target.value)} />
      </Field>
      <Field label="Decisions, one per line" wide>
        <textarea rows={6} value={decisions} onChange={(ev) => setDecisions(ev.target.value)} />
      </Field>
      <Field label="Action items, one per line as Name: action" wide>
        <textarea rows={6} value={actions} onChange={(ev) => setActions(ev.target.value)} placeholder={`Blake: Send the calendar link\nAli: Embed it on the end screen`} />
      </Field>
    </FormShell>
  );
}

function ClientForm({ e, onDone }: { e: Extract<Editing, { kind: 'client' }>; onDone: () => void }) {
  const { save, remove, toast } = useData();
  const { stages } = useConfig();
  const [c, setC] = useState<Client>(e.row);
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((x) => ({ ...x, [k]: v }));

  const changeOffer = (offer: Offer) => setC((x) => ({ ...x, offer, stage: stages[offer][0].id }));

  const submit = () => {
    if (!c.name.trim()) return toast('Add a name first');
    save('clients', { ...c, name: c.name.trim() });
    toast(e.isNew ? 'Client added' : 'Client saved');
    onDone();
  };

  return (
    <FormShell saveLabel={e.isNew ? 'Add client' : 'Save client'} onSubmit={submit} onDelete={e.isNew ? undefined : () => (remove('clients', c.id), onDone())}>
      <Field label="Contact name">
        <input value={c.name} onChange={(ev) => set('name', ev.target.value)} />
      </Field>
      <Field label="Business">
        <input value={c.company} onChange={(ev) => set('company', ev.target.value)} placeholder="Business or niche" />
      </Field>
      <Field label="Offer">
        <select value={c.offer} onChange={(ev) => changeOffer(ev.target.value as Offer)}>
          {OFFERS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Stage">
        <select value={c.stage} onChange={(ev) => set('stage', ev.target.value)}>
          {stages[c.offer].map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={c.offer === 'agency' ? 'Program price, USD' : 'Setup value, USD'}>
        <input type="number" min={0} step={100} value={c.setup_value || ''} onChange={(ev) => set('setup_value', Number(ev.target.value) || 0)} />
      </Field>
      <Field label="Monthly retainer, USD">
        <input type="number" min={0} step={50} value={c.monthly || ''} onChange={(ev) => set('monthly', Number(ev.target.value) || 0)} />
      </Field>
      <Field label="CSM">
        <select value={c.csm} onChange={(ev) => set('csm', ev.target.value)}>
          <TeamOptions value={c.csm} />
        </select>
      </Field>
      <Field label="Next call or deadline">
        <input type="date" value={c.next_date ?? ''} onChange={(ev) => set('next_date', ev.target.value || null)} />
      </Field>
      <Field label="Next action" wide>
        <input value={c.next_action} onChange={(ev) => set('next_action', ev.target.value)} placeholder="Send proposal after reviewing the audit recording" />
      </Field>
      <Field label="Discord or support channel" wide>
        <input type="url" value={c.channel} onChange={(ev) => set('channel', ev.target.value)} placeholder="https://discord.com/channels/..." />
      </Field>
      <Field label="Notes" wide>
        <textarea rows={6} value={c.notes} onChange={(ev) => set('notes', ev.target.value)} placeholder="Pains, current tools, what we are building" />
      </Field>
    </FormShell>
  );
}

