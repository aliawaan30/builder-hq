-- Builder HQ schema. Run in a NEW Supabase project (not the live student one).
-- SQL Editor, paste, Run. Safe to run again after updates.

create table if not exists public.team_members (
  email text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- True when the signed in user is on the team list.
create or replace function public.is_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

create table if not exists public.tasks (
  id uuid primary key,
  title text not null,
  notes text not null default '',
  workstream text not null,
  status text not null check (status in ('backlog', 'next', 'doing', 'review', 'done')),
  owner text not null,
  priority smallint not null default 2 check (priority between 1 and 3),
  size text not null default 'quick' check (size in ('quick', 'big')),
  due date,
  meeting_id uuid,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after v1. Safe on databases created before checklists.
alter table public.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;

create table if not exists public.meetings (
  id uuid primary key,
  date date not null,
  title text not null,
  recording text not null default '',
  summary text not null default '',
  decisions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key,
  name text not null,
  company text not null default '',
  offer text not null check (offer in ('business', 'agency')),
  stage text not null,
  setup_value numeric(12, 2) not null default 0,
  monthly numeric(12, 2) not null default 0,
  csm text not null default '',
  next_action text not null default '',
  next_date date,
  channel text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Team, workstreams and client stages, edited on the Setup page. One row.
create table if not exists public.app_config (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists meetings_date_idx on public.meetings (date desc);
create index if not exists clients_offer_stage_idx on public.clients (offer, stage);

-- Row level security: only team members can read or write anything.
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.clients enable row level security;
alter table public.app_config enable row level security;

-- Team members manage the access list from Setup. The app never removes the signed in user.
drop policy if exists "team reads members" on public.team_members;
drop policy if exists "team manages members" on public.team_members;
create policy "team manages members" on public.team_members
  for all to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "team manages config" on public.app_config;
create policy "team manages config" on public.app_config
  for all to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "team manages tasks" on public.tasks;
create policy "team manages tasks" on public.tasks
  for all to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "team manages meetings" on public.meetings;
create policy "team manages meetings" on public.meetings
  for all to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "team manages clients" on public.clients;
create policy "team manages clients" on public.clients
  for all to authenticated using (public.is_team()) with check (public.is_team());

-- Live sync between teammates.
do $$
declare t text;
begin
  foreach t in array array['tasks', 'meetings', 'clients', 'app_config'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Who can see the data. Each person also needs a login: Authentication, Users, Add user.
delete from public.team_members where email like '%@example.com';
insert into public.team_members (email, name) values
  ('ali@theaiagencybuilder.com', 'Ali'),
  ('blake@theaiagencybuilder.com', 'Blake')
on conflict (email) do nothing;
