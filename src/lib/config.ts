import type { Config, Member, Offer, Stage, TaskStatus, WorkstreamDef } from './types';

/** Board columns. Fixed, because the app logic depends on them. */
export const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'next', label: 'Up next' },
  { id: 'doing', label: 'In progress' },
  { id: 'review', label: 'In review' },
  { id: 'done', label: 'Done' },
];

export const statusLabel = (id: TaskStatus): string => STATUSES.find((s) => s.id === id)?.label ?? id;

export const OFFERS: { id: Offer; label: string }[] = [
  { id: 'business', label: 'Business builds' },
  { id: 'agency', label: 'Agency high ticket' },
];

export const PALETTE = ['#2F4FD6', '#0E8A7E', '#7B45C9', '#C26A1B', '#C2367A', '#6B7A8C', '#3F7D2E', '#B8382A', '#0B7FAB', '#8A6D12'];

const stage = (id: string, label: string, won: boolean, closed = false): Stage => ({ id, label, won, closed });

export const DEFAULT_CONFIG: Config = {
  team: [
    { id: 'ali', name: 'Ali', email: 'ali@theaiagencybuilder.com', tz: 'Asia/Karachi', place: 'Pakistan', start: 9, end: 18, color: '#2F4FD6' },
    { id: 'blake', name: 'Blake', email: 'blake@theaiagencybuilder.com', tz: 'Australia/Brisbane', place: 'Gold Coast', start: 9, end: 18, color: '#C26A1B' },
  ],
  workstreams: [
    { id: 'onboarding', label: 'Onboarding flow', color: '#0E8A7E' },
    { id: 'course', label: 'Course flow', color: '#2F4FD6' },
    { id: 'high-ticket', label: 'High ticket offer', color: '#7B45C9' },
    { id: 'low-ticket', label: 'Low ticket offer', color: '#C26A1B' },
    { id: 'skool', label: 'Skool queries', color: '#C2367A' },
  ],
  stages: {
    business: [
      stage('audit', 'Audit call', false),
      stage('proposal', 'Proposal', false),
      stage('close', 'Close call', false),
      stage('building', 'Building', true),
      stage('live', 'Live', true),
      stage('lost', 'Lost', false, true),
    ],
    agency: [
      stage('onboarding', 'Onboarding', true),
      stage('offer', 'Niche and offer', true),
      stage('build', 'Build', true),
      stage('clients', 'Getting clients', true),
      stage('scale', 'Scaling', true),
      stage('paused', 'Paused', true, true),
    ],
  },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Accepts anything from storage and returns a valid config, falling back to defaults per section. */
export function normalizeConfig(raw: unknown): Config {
  if (!isObj(raw)) return structuredClone(DEFAULT_CONFIG);
  const team: Member[] = Array.isArray(raw.team)
    ? raw.team.filter(isObj).map((m, i) => ({
        id: str(m.id, `m${i}`),
        name: str(m.name).trim(),
        email: str(m.email).trim(),
        tz: str(m.tz, 'UTC'),
        place: str(m.place),
        start: num(m.start, 9),
        end: num(m.end, 17),
        color: str(m.color, PALETTE[i % PALETTE.length]),
      })).filter((m) => m.name)
    : [];
  const workstreams: WorkstreamDef[] = Array.isArray(raw.workstreams)
    ? raw.workstreams.filter(isObj).map((w, i) => ({ id: str(w.id), label: str(w.label).trim(), color: str(w.color, PALETTE[i % PALETTE.length]) })).filter((w) => w.id && w.label)
    : [];
  const stagesRaw = isObj(raw.stages) ? raw.stages : {};
  const stages = {} as Config['stages'];
  for (const o of OFFERS) {
    const list = Array.isArray(stagesRaw[o.id]) ? (stagesRaw[o.id] as unknown[]) : [];
    const clean = list.filter(isObj).map((s) => stage(str(s.id), str(s.label).trim(), s.won === true, s.closed === true)).filter((s) => s.id && s.label);
    stages[o.id] = clean.length ? clean : structuredClone(DEFAULT_CONFIG.stages[o.id]);
  }
  return {
    team: team.length ? team : structuredClone(DEFAULT_CONFIG.team),
    workstreams: workstreams.length ? workstreams : structuredClone(DEFAULT_CONFIG.workstreams),
    stages,
  };
}
