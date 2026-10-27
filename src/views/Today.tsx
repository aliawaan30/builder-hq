import { DayStrip } from '../components/DayStrip';
import { useEditor } from '../components/Editor';
import { TaskCard, byUrgency } from '../components/TaskCard';
import { Avatar, Empty } from '../components/ui';
import { statusLabel } from '../lib/config';
import { useData } from '../lib/data';
import { newTask } from '../lib/factory';
import { addDays, fmtDate, fmtLongDate, localHour, todayIn } from '../lib/time';
import { useConfig } from '../lib/useConfig';

export function Today() {
  const { db, me, ready } = useData();
  const open = useEditor();
  const { team, memberOf, stage, workstreams } = useConfig();
  const tz = memberOf(me)?.tz ?? team[0].tz;
  const today = todayIn(tz);
  const hour = localHour(tz);
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const live = db.tasks.filter((t) => t.status !== 'done');
  const mine = live.filter((t) => t.owner === me && t.status !== 'backlog').sort(byUrgency);
  const others = team.filter((m) => m.name !== me);
  const late = live.filter((t) => t.due && t.due < today).sort(byUrgency);
  const meetings = [...db.meetings].sort((a, b) => b.date.localeCompare(a.date));
  const decisions = meetings.flatMap((m) => m.decisions.map((d, i) => ({ key: `${m.id}${i}`, d, m }))).slice(0, 6);
  const week = addDays(today, 7);
  const calls = db.clients
    .filter((c) => c.next_date && c.next_date <= week && !stage(c.offer, c.stage)?.closed)
    .sort((a, b) => (a.next_date ?? '').localeCompare(b.next_date ?? ''));

  const isEmpty = ready && !db.tasks.length && !db.meetings.length && !db.clients.length;

  return (
    <div className="page today">
      <header className="page-head">
        <div>
          <h1>
            {greet}, {me}
          </h1>
          <p className="sub">{fmtLongDate(tz)}</p>
        </div>
      </header>

      <DayStrip />

      {isEmpty && (
        <div className="callout">
          <div>
            <b>Clean slate.</b> Add your first task, or press N anywhere. Tip: make one task per week in Skool queries and add each person you need to answer as a checklist item.
          </div>
          <button type="button" className="btn btn-primary" onClick={() => open({ kind: 'task', isNew: true, row: newTask({ owner: me, workstream: workstreams[0].id, status: 'next' }) })}>
            Add first task
          </button>
        </div>
      )}

      <div className="today-grid">
        <section className="panel">
          <h2>Your focus</h2>
          {mine.length ? (
            <div className="stack">
              {mine.slice(0, 7).map((t) => (
                <button key={t.id} type="button" className="card" onClick={() => open({ kind: 'task', row: t })}>
                  <TaskCard t={t} />
                </button>
              ))}
            </div>
          ) : (
            <Empty title="No active tasks on your name">Move something into Up next on the board.</Empty>
          )}
        </section>

        <div className="today-side">
          {late.length > 0 && (
            <section className="panel is-alert">
              <h2>Overdue</h2>
              <ul className="rows">
                {late.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="row-btn" onClick={() => open({ kind: 'task', row: t })}>
                      <span>{t.title}</span>
                      <span className="row-meta">
                        {fmtDate(t.due!)} <Avatar name={t.owner} size={18} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {others.map((m) => {
            const theirs = live.filter((t) => t.owner === m.name && (t.priority === 1 || t.status === 'doing' || t.status === 'review')).sort(byUrgency);
            return (
              <section className="panel" key={m.name}>
                <h2>Waiting on {m.name}</h2>
                {theirs.length ? (
                  <ul className="rows">
                    {theirs.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="row-btn" onClick={() => open({ kind: 'task', row: t })}>
                          <span>{t.title}</span>
                          <span className="row-meta">{statusLabel(t.status)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Nothing urgent on {m.name}.</p>
                )}
              </section>
            );
          })}

          <section className="panel">
            <h2>Client calls this week</h2>
            {calls.length ? (
              <ul className="rows">
                {calls.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="row-btn" onClick={() => open({ kind: 'client', row: c })}>
                      <span>
                        {c.name}
                        {c.company && <span className="muted">, {c.company}</span>}
                      </span>
                      <span className="row-meta">{fmtDate(c.next_date!)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No client calls in the next 7 days.</p>
            )}
          </section>
        </div>
      </div>

      {decisions.length > 0 && (
        <section className="panel">
          <h2>Latest decisions</h2>
          <ul className="decisions">
            {decisions.map(({ key, d, m }) => (
              <li key={key}>
                <p>{d}</p>
                <a href="#meetings" className="muted">
                  {fmtDate(m.date)}, {m.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
