import { useData } from '../lib/data';
import { useConfig } from '../lib/useConfig';
import { useNow } from '../lib/hooks';
import { dayGrid, fmtClock, fmtMin, overlapStatus, runs } from '../lib/time';
import { Avatar } from './ui';

const pct = (min: number) => `${(min / 1440) * 100}%`;

function useOverlap() {
  const { me } = useData();
  const { team, memberOf } = useConfig();
  const now = useNow();
  const viewer = memberOf(me) ?? team[0];
  const grid = dayGrid(team, viewer.tz, now);
  return { now, viewer, team, ...grid, status: overlapStatus(grid.overlap, grid.nowMin) };
}

/** Compact version for the top bar. */
export function ClockBar() {
  const { now, status, team } = useOverlap();
  return (
    <div className="clockbar">
      {team.map((m) => (
        <span key={m.name} className="clock">
          <Avatar name={m.name} size={18} />
          <span>{fmtClock(m.tz, now)}</span>
        </span>
      ))}
      <span className={`pill${status.open ? ' is-open' : ''}`}>{status.text}</span>
    </div>
  );
}

/** The full 24 hour view on Today. */
export function DayStrip() {
  const { now, viewer, team, rows, overlap, nowMin, status } = useOverlap();
  const shared = runs(overlap);
  return (
    <section className="day" aria-label="Working hours overlap">
      <div className="day-head">
        <h2 className={status.open ? 'is-open' : ''}>{status.text}</h2>
        <p>
          {shared.length
            ? `Shared hours in ${viewer.name}’s time: ${shared.map(([a, b]) => `${fmtMin(a)} to ${fmtMin(b)}`).join(', ')}`
            : 'Working hours do not overlap. Adjust them in Setup.'}
        </p>
      </div>
      <div className="day-grid">
        {team.map((m, i) => (
          <div className="day-row" key={m.name}>
            <div className="day-who">
              <Avatar name={m.name} size={28} />
              <span>
                <b>{m.name}</b>
                <small>
                  {fmtClock(m.tz, now)}, {m.place}
                </small>
              </span>
            </div>
            <div className="track">
              {shared.map(([a, b]) => (
                <span key={`o${a}`} className="track-overlap" style={{ left: pct(a), width: pct(b - a) }} />
              ))}
              {runs(rows[i]).map(([a, b]) => (
                <span key={a} className="track-work" style={{ left: pct(a), width: pct(b - a), background: m.color }} />
              ))}
              <span className="track-now" style={{ left: pct(nowMin) }} />
            </div>
          </div>
        ))}
        <div className="day-scale" aria-hidden="true">
          <span>12 am</span>
          <span>6 am</span>
          <span>12 pm</span>
          <span>6 pm</span>
          <span>12 am</span>
        </div>
      </div>
    </section>
  );
}
