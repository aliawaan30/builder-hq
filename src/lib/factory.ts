import type { Client, Meeting, Offer, Task } from './types';

export const uid = (): string => crypto.randomUUID();
const stamp = () => {
  const t = new Date().toISOString();
  return { created_at: t, updated_at: t };
};

export const newTask = (p: Partial<Task> & { owner: string; workstream: string }): Task => ({
  id: uid(),
  title: '',
  notes: '',
  status: 'backlog',
  priority: 2,
  size: 'quick',
  due: null,
  meeting_id: null,
  checklist: [],
  ...stamp(),
  ...p,
});

export const newMeeting = (p: Partial<Meeting> = {}): Meeting => ({
  id: uid(),
  date: new Date().toISOString().slice(0, 10),
  title: '',
  recording: '',
  summary: '',
  decisions: [],
  actions: [],
  ...stamp(),
  ...p,
});

export const newClient = (offer: Offer, stage: string, p: Partial<Client> = {}): Client => ({
  id: uid(),
  name: '',
  company: '',
  offer,
  stage,
  setup_value: 0,
  monthly: 0,
  csm: '',
  next_action: '',
  next_date: null,
  channel: '',
  notes: '',
  ...stamp(),
  ...p,
});

export const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
