# Builder HQ

Internal project management for The AI Agency Builder. Task board by workstream, meetings and decisions log, and a client tracker for business builds and high ticket agency students.

Stack: Vite, React 18, strict TypeScript, Supabase (email and password login, Postgres, realtime). No UI framework.

## Run it locally

```
npm install
npm run dev
```

With no Supabase keys it runs in local mode: data stays in your browser. It starts empty, with five workstreams: Onboarding flow, Course flow, High ticket offer, Low ticket offer and Skool queries. Change them on the Setup page.

## Turn on team sync (Supabase)

1. Create a new Supabase project. Keep it separate from the live onboarding project.
2. SQL Editor: paste `supabase/schema.sql` and run it. Safe to run again.
3. Authentication, Users, Add user, Create new user: add each person with an email and password, and tick Auto Confirm User. No emails are sent, so no SMTP is needed.
4. Authentication, Sign In / Providers: turn off "Allow new users to sign up". Only people you add can log in.
5. Copy `.env.example` to `.env` and fill in the Project URL and the publishable key.

## Deploy on Netlify

1. Push this folder to a private GitHub repo and import it in Netlify. `netlify.toml` sets the build.
2. Site configuration, Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Sign in and add your first task.

## Deploy checklist

1. New Supabase project, not the live onboarding one.
2. Run `supabase/schema.sql`.
3. Add Ali and Blake under Authentication, Users, with Auto Confirm User ticked.
4. Turn off new sign ups.
5. Netlify: import from GitHub, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key), deploy.
6. Sign in as Ali, then Blake in another browser. Move a card and check it moves for the other person without a refresh.

To reset a password: Authentication, Users, click the person, Reset password, or delete and re-add them.

Known limits: drag and drop needs a mouse. On phones, open a card and change its status.

## Setup page

Add, rename or remove team members, workstreams and client stages from Setup in the app. Nothing to edit in code.

1. Removing something that is in use asks where its tasks or clients should go.
2. Renaming a person updates their tasks, clients and action items.
3. In cloud mode the team list controls who can see the data. Removing someone takes their access away. Adding someone also needs a login created in Supabase. You cannot remove yourself.

Board columns (Backlog to Done) stay fixed because the Today page depends on them.

## Where things live

```
src/lib/config.ts    default team, workstreams and stages, board columns
src/views/Setup.tsx  editing team, workstreams and stages in the app
src/lib/store.ts     local and Supabase storage behind one interface
src/lib/data.tsx     app state, optimistic saves, live sync
src/views/           Today, Board, Meetings, Clients
src/components/      kanban, drawer forms, overlap strip
supabase/schema.sql  tables, row level security, realtime
```

Shortcuts: N new task, 1 to 5 switch pages, slash searches the board, Esc closes panels, Ctrl or Cmd plus Enter saves a form.
