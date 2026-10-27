import { useMemo, useState } from 'react';
import { useEditor } from '../components/Editor';
import { Avatar, Empty, Icon } from '../components/ui';
import { statusLabel } from '../lib/config';
import { useData } from '../lib/data';
import { newMeeting, newTask } from '../lib/factory';
import { fmtDate } from '../lib/time';
import type { ActionItem, Meeting } from '../lib/types';
import { useConfig } from '../lib/useConfig';

type Tab = 'meetings' | 'decisions';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Meetings() {
  const { db } = useData();
  const open = useEditor();
  const [tab, setTab] = useState<Tab>('meetings');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = useMemo(() => [...db.meetings].sort((a, b) => b.date.localeCompare(a.date)), [db.meetings]);
  const needle = q.trim().toLowerCase();
  const list = sorted.filter((m) => !needle || `${m.title} ${m.summary} ${m.decisions.join(' ')}`.toLowerCase().includes(needle));
  const current = sorted.find((m) => m.id === selected) ?? list[0];

  return (
    <div className="page page-wide">
      <header className="page-head">
        <div>
          <h1>Meetings and decisions</h1>
          <p className="sub">Every call, what was decided and who owns what.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'meeting', isNew: true, row: newMeeting() })}>
          <Icon name="plus" size={16} /> New meeting
        </button>
      </header>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'meetings'} className={tab === 'meetings' ? 'is-on' : ''} onClick={() => setTab('meetings')}>
            Meetings
          </button>
          <button type="button" role="tab" aria-selected={tab === 'decisions'} className={tab === 'decisions' ? 'is-on' : ''} onClick={() => setTab('decisions')}>
            All decisions
          </button>
        </div>
        <div className="search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meetings and decisions" aria-label="Search" />
        </div>
      </div>

      {!sorted.length ? (
        <Empty title="No meetings logged yet">Add your last call with Blake, or load the project history from Today.</Empty>
      ) : tab === 'decisions' ? (
        <DecisionLog meetings={list} needle={needle} onPick={(id) => (setSelected(id), setTab('meetings'))} />
      ) : (
        <div className="split">
          <nav className="mlist" aria-label="Meetings">
            {list.map((m) => (
              <button key={m.id} type="button" className={`mitem${current?.id === m.id ? ' is-on' : ''}`} onClick={() => setSelected(m.id)}>
                <span className="mitem-date">{fmtDate(m.date)}</span>
                <span className="mitem-title">{m.title}</span>
                <span className="muted">
                  {plural(m.decisions.length, 'decision')}, {plural(m.actions.length, 'action')}
                </span>
              </button>
            ))}
            {!list.length && <p className="muted pad">No match.</p>}
          </nav>
          {current && <MeetingDetail m={current} />}
        </div>
      )}
    </div>
  );
}

function MeetingDetail({ m }: { m: Meeting }) {
  const { db, save } = useData();
  const { workstreams } = useConfig();
  const open = useEditor();

  const toBoard = (a: ActionItem) =>
    open({
      kind: 'task',
      isNew: true,
      row: newTask({ title: a.text, owner: a.owner, workstream: workstreams[0].id, meeting_id: m.id, status: 'next' }),
      onSaved: (t) => save('meetings', { ...m, actions: m.actions.map((x) => (x.id === a.id ? { ...x, task_id: t.id } : x)) }),
    });

  return (
    <article className="mdetail">
      <header className="mdetail-head">
        <div>
          <p className="muted">{fmtDate(m.date, true)}</p>
          <h2>{m.title}</h2>
        </div>
        <div className="row-gap">
          {m.recording && (
            <a className="btn" href={m.recording} target="_blank" rel="noreferrer">
              <Icon name="link" size={16} /> Recording
            </a>
          )}
          <button type="button" className="btn" onClick={() => open({ kind: 'meeting', row: m })}>
            Edit
          </button>
        </div>
      </header>

      {m.summary && <p className="lede">{m.summary}</p>}

      <h3>Decisions</h3>
      {m.decisions.length ? (
        <ul className="decisions">
          {m.decisions.map((d, i) => (
            <li key={i}>
              <p>{d}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No decisions logged.</p>
      )}

      <h3>Action items</h3>
      {m.actions.length ? (
        <ul className="actions">
          {m.actions.map((a) => {
            const task = a.task_id ? db.tasks.find((t) => t.id === a.task_id) : undefined;
            return (
              <li key={a.id}>
                <Avatar name={a.owner} size={22} />
                <span className="action-text">{a.text}</span>
                {task ? (
                  <button type="button" className={`status s-${task.status}`} onClick={() => open({ kind: 'task', row: task })}>
                    {statusLabel(task.status)}
                  </button>
                ) : (
                  <button type="button" className="btn btn-small" onClick={() => toBoard(a)}>
                    Add to board
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">No action items.</p>
      )}
    </article>
  );
}

function DecisionLog({ meetings, needle, onPick }: { meetings: Meeting[]; needle: string; onPick: (id: string) => void }) {
  const groups = meetings
    .map((m) => ({ m, items: m.decisions.filter((d) => !needle || d.toLowerCase().includes(needle) || m.title.toLowerCase().includes(needle)) }))
    .filter((g) => g.items.length);
  if (!groups.length) return <Empty title="No decisions match" />;
  return (
    <div className="dlog">
      {groups.map(({ m, items }) => (
        <section key={m.id} className="dgroup">
          <button type="button" className="dgroup-head" onClick={() => onPick(m.id)}>
            <span className="mitem-date">{fmtDate(m.date)}</span> {m.title}
          </button>
          <ul className="decisions">
            {items.map((d, i) => (
              <li key={i}>
                <p>{d}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
