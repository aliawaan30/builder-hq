/** Workstream id, defined in Setup. */
export type Workstream = string;
export type TaskStatus = 'backlog' | 'next' | 'doing' | 'review' | 'done';
export type Priority = 1 | 2 | 3;
export type Size = 'quick' | 'big';
export type Offer = 'business' | 'agency';

interface Stamped {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task extends Stamped {
  title: string;
  notes: string;
  workstream: Workstream;
  status: TaskStatus;
  owner: string;
  priority: Priority;
  size: Size;
  due: string | null;
  meeting_id: string | null;
  checklist: ChecklistItem[];
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  task_id: string | null;
}

export interface Meeting extends Stamped {
  date: string;
  title: string;
  recording: string;
  summary: string;
  decisions: string[];
  actions: ActionItem[];
}

export interface Client extends Stamped {
  name: string;
  company: string;
  offer: Offer;
  stage: string;
  setup_value: number;
  monthly: number;
  csm: string;
  next_action: string;
  next_date: string | null;
  channel: string;
  notes: string;
}

export interface DB {
  tasks: Task[];
  meetings: Meeting[];
  clients: Client[];
}

export type Table = keyof DB;
export type Row<T extends Table> = DB[T][number];
export type AnyRow = Task | Meeting | Client;

/** Editable in Setup and stored with the data. */
export interface Member {
  id: string;
  name: string;
  email: string;
  tz: string;
  place: string;
  start: number;
  end: number;
  color: string;
}

export interface WorkstreamDef {
  id: string;
  label: string;
  color: string;
}

export interface Stage {
  id: string;
  label: string;
  /** Paying client at this stage. */
  won: boolean;
  /** Counts as inactive. */
  closed: boolean;
}

export interface Config {
  team: Member[];
  workstreams: WorkstreamDef[];
  stages: Record<Offer, Stage[]>;
}
