import { useConfig } from '../lib/useConfig';
import { fmtDate, todayIn } from '../lib/time';
import type { Task } from '../lib/types';
import { Avatar, Icon } from './ui';

export function TaskCard({ t }: { t: Task }) {
  const { memberOf, ws } = useConfig();
  const stream = ws(t.workstream);
  const today = todayIn(memberOf(t.owner)?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const late = !!t.due && t.status !== 'done' && t.due < today;
  return (
    <>
      <span className="card-title">{t.title}</span>
      <span className="card-meta">
        <span className="ws">
          <i style={{ background: stream.color }} />
          {stream.label}
        </span>
        {t.priority === 1 && t.status !== 'done' && <span className="tag tag-p1">P1</span>}
        {t.size === 'big' && <span className="tag">Bigger build</span>}
        {t.checklist.length > 0 && <Progress t={t} />}
        {t.due && <span className={`due${late ? ' is-late' : ''}`}>{late ? `Late, ${fmtDate(t.due)}` : fmtDate(t.due)}</span>}
        <span className="spacer" />
        <Avatar name={t.owner} size={20} />
      </span>
    </>
  );
}

function Progress({ t }: { t: Task }) {
  const done = t.checklist.filter((i) => i.done).length;
  const all = t.checklist.length;
  return (
    <span className={`tag tag-check${done === all ? ' is-complete' : ''}`} title={`${done} of ${all} checklist items done`}>
      <Icon name="check" size={12} />
      {done}/{all}
    </span>
  );
}

export const byUrgency = (a: Task, b: Task): number =>
  a.priority - b.priority || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.created_at.localeCompare(b.created_at);
