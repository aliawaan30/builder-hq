-- Turns open access off. Only signed in team members can see data again.
drop policy if exists "open tasks" on public.tasks;
drop policy if exists "open meetings" on public.meetings;
drop policy if exists "open clients" on public.clients;
drop policy if exists "open config" on public.app_config;
drop policy if exists "open members" on public.team_members;
revoke insert, update, delete on public.tasks, public.meetings, public.clients, public.app_config from anon;
