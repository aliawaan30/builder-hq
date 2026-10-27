-- OPEN ACCESS: anyone with the site link can read, edit and delete everything.
-- Run after schema.sql. To lock it again, run lock.sql and remove VITE_OPEN_ACCESS in Netlify.

drop policy if exists "open tasks" on public.tasks;
create policy "open tasks" on public.tasks for all to anon using (true) with check (true);

drop policy if exists "open meetings" on public.meetings;
create policy "open meetings" on public.meetings for all to anon using (true) with check (true);

drop policy if exists "open clients" on public.clients;
create policy "open clients" on public.clients for all to anon using (true) with check (true);

drop policy if exists "open config" on public.app_config;
create policy "open config" on public.app_config for all to anon using (true) with check (true);

drop policy if exists "open members" on public.team_members;
create policy "open members" on public.team_members for select to anon using (true);

grant select, insert, update, delete on public.tasks, public.meetings, public.clients, public.app_config to anon;
grant select on public.team_members to anon;
