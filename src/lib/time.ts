const SLOTS = 48;

const tzCache = new Map<string, boolean>();
/** True for time zones this browser understands. */
export function validTz(tz: string): boolean {
  if (!tzCache.has(tz)) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      tzCache.set(tz, true);
    } catch {
      tzCache.set(tz, false);
    }
  }
  return tzCache.get(tz)!;
}
const safeTz = (tz: string) => (validTz(tz) ? tz : 'UTC');
const DAY = 1440;
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Minutes ahead of UTC for a time zone at a given moment. */
export function tzOffset(tz: string, at: Date = new Date()): number {
  if (!validTz(tz)) return 0;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

export const fmtClock = (tz: string, at: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: safeTz(tz), hour: 'numeric', minute: '2-digit' }).format(at).toLowerCase();

export const localHour = (tz: string, at: Date = new Date()): number =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: safeTz(tz), hour: 'numeric', hourCycle: 'h23' }).format(at));

/** Today as YYYY-MM-DD in a time zone. */
export const todayIn = (tz: string, at: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: safeTz(tz) }).format(at);

export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const fmtDate = (iso: string, withYear = false): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d);
};

export const fmtLongDate = (tz: string, at: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: safeTz(tz), weekday: 'long', day: 'numeric', month: 'long' }).format(at);

interface Window {
  start: number;
  end: number;
  tz: string;
}

/** Half hour grid of the viewer's day: which slots each person is working. */
export function dayGrid(people: Window[], viewerTz: string, at: Date = new Date()) {
  const vOff = tzOffset(viewerTz, at);
  const rows = people.map((p) => {
    const off = tzOffset(p.tz, at);
    return Array.from({ length: SLOTS }, (_, i) => {
      const local = mod(i * 30 - vOff + off, DAY);
      return local >= p.start * 60 && local < p.end * 60;
    });
  });
  const overlap = Array.from({ length: SLOTS }, (_, i) => rows.every((r) => r[i]));
  const nowMin = mod(Math.floor(at.getTime() / 60000) + vOff, DAY);
  return { rows, overlap, nowMin };
}

/** Continuous runs of true slots, as [startMin, endMin]. */
export function runs(slots: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= slots.length; i++) {
    const on = i < slots.length && slots[i];
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      out.push([s * 30, i * 30]);
      s = -1;
    }
  }
  return out;
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'am' : 'pm';
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}

const dur = (m: number) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
};

export function overlapStatus(overlap: boolean[], nowMin: number): { open: boolean; text: string } {
  const rs = runs(overlap);
  if (!rs.length) return { open: false, text: 'No shared hours today' };
  const cur = rs.find(([a, b]) => nowMin >= a && nowMin < b);
  if (cur) return { open: true, text: `Overlap open, ${dur(cur[1] - nowMin)} left` };
  const wait = Math.min(...rs.map(([a]) => (a > nowMin ? a - nowMin : a + DAY - nowMin)));
  return { open: false, text: `Overlap opens in ${dur(wait)}` };
}
