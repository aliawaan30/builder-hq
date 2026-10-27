import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../components/Editor';
import { Kanban } from '../components/Kanban';
import { TaskCard, byUrgency } from '../components/TaskCard';
import { Icon } from '../components/ui';
import { STATUSES } from '../lib/config';
import { useData } from '../lib/data';
import { newTask } from '../lib/factory';
import { isTyping } from '../lib/hooks';
import type { Task, TaskStatus } from '../lib/types';
import { useConfig } from '../lib/useConfig';

export function Board() {
  const { db, me, save } = useData();
  const open = useEditor();
  const { team, workstreams } = useConfig();
  const [ws, setWs] = useState<string>('all');
  const [owner, setOwner] = useState('all');
  const [q, setQ] = useState('');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTyping()) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.tasks
      .filter((t) => ws === 'all' || t.workstream === ws)
      .filter((t) => owner === 'all' || t.owner === owner)
      .filter((t) => !needle || `${t.title} ${t.notes} ${t.checklist.map((i) => i.text).join(' ')}`.toLowerCase().includes(needle))
      .sort(byUrgency);
  }, [db.tasks, ws, owner, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of db.tasks) if (t.status !== 'done') c[t.workstream] = (c[t.workstream] ?? 0) + 1;
    return c;
  }, [db.tasks]);

  const add = (status: TaskStatus = 'backlog') =>
    open({ kind: 'task', isNew: true, row: newTask({ status, owner: me, workstream: ws === 'all' ? workstreams[0].id : ws }) });

  return (
    <div className="page page-wide">
      <header className="page-head">
        <div>
          <h1>Board</h1>
          <p className="sub">Drag cards between columns. Press N for a new task, slash to search.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => add()}>
          <Icon name="plus" size={16} /> New task
        </button>
      </header>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
        </div>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
          <option value="all">Everyone</option>
          {team.map((m) => (
            <option key={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="chips" role="tablist" aria-label="Workstream">
        <button type="button" role="tab" aria-selected={ws === 'all'} className={`chip${ws === 'all' ? ' is-on' : ''}`} onClick={() => setWs('all')}>
          All
        </button>
        {workstreams.map((w) => (
          <button key={w.id} type="button" role="tab" aria-selected={ws === w.id} className={`chip${ws === w.id ? ' is-on' : ''}`} onClick={() => setWs(w.id)}>
            <i style={{ background: w.color }} />
            {w.label}
            {counts[w.id] ? <span className="chip-n">{counts[w.id]}</span> : null}
          </button>
        ))}
      </div>

      <Kanban<Task>
        label="Task board"
        columns={STATUSES}
        items={items}
        columnOf={(t) => t.status}
        onMove={(t, status) => save('tasks', { ...t, status: status as TaskStatus })}
        onOpen={(t) => open({ kind: 'task', row: t })}
        onAdd={(col) => add(col as TaskStatus)}
        renderCard={(t) => <TaskCard t={t} />}
      />
    </div>
  );
}
