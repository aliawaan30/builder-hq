# Builder HQ

Internal project management for The AI Agency Builder. Task board by workstream, meetings and decisions log, and a client tracker for business builds and high ticket agency students.

Stack: Vite, React 18, strict TypeScript, Supabase (auth, Postgres, realtime). No UI framework.

## Run it locally

```
npm install
npm run dev
```

With no Supabase keys it runs in local mode: data stays in your browser. It starts empty, with five workstreams: Onboarding flow, Course flow, High ticket offer, Low ticket offer and Skool queries. Change them on the Setup page.

## Turn on team sync (Supabase)

1. Create a new Supabase project. Keep it separate from the live onboarding project.
2. SQL Editor: paste `supabase/schema.sql`, change the two emails at the bottom to the real ones, run it.
3. Authentication, Email templates, Magic link: make sure the template includes `{{ .Token }}` so people get a 6 digit code. The link in the email also works.
4. Authentication, URL configuration: set Site URL to your Netlify URL.
5. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project settings, API).

## Deploy on Netlify

1. Push this folder to a private GitHub repo and import it in Netlify. `netlify.toml` sets the build.
2. Site configuration, Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Sign in with your email and add your first task.

## Deploy checklist

1. New Supabase project, not the live onboarding one.
2. Run `supabase/schema.sql` with real emails at the bottom. It is safe to run again.
3. Authentication, URL configuration: Site URL is the Netlify URL.
4. Authentication, Email templates, Magic link: includes `{{ .Token }}`.
5. Supabase's built in email only sends a few emails an hour. Fine for two people. Add custom SMTP (Authentication, SMTP settings) before adding more of the team.
6. Netlify: deploy from a private Git repo, add both `VITE_` variables, then redeploy.
7. Sign in as Ali and add a first task.
8. Sign in as Blake in another browser. Move a card and check it moves for Ali without a refresh.
9. Setup: add real emails for both of you if they are missing.

Known limits: drag and drop needs a mouse. On phones, open a card and change its status. Backups download on Netlify, not inside the Claude preview.

## Setup page

Add, rename or remove team members, workstreams and client stages from Setup in the app. Nothing to edit in code.

1. Removing something that is in use asks where its tasks or clients should go.
2. Renaming a person updates their tasks, clients and action items.
3. In cloud mode the team list is also the sign in list. Adding someone with an email gives them access. Removing them takes it away. You cannot remove yourself.

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
