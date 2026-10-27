import type { Session } from '@supabase/supabase-js';
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Crash, Problem } from './components/Crash';
import { Login } from './Login';
import { DEFAULT_CONFIG } from './lib/config';
import { DataProvider } from './lib/data';
import { cloudStore, localStore } from './lib/store';
import { configError, requireLogin, supabase } from './lib/supabase';
import type { Store } from './lib/store';
import './styles.css';

const ME_KEY = 'builder-hq.me';

/** No login: the person picks who they are, remembered in this browser. */
function PickedUserApp({ makeStore }: { makeStore: () => Store }) {
  const store = useMemo(makeStore, [makeStore]);
  const [me, setMeState] = useState(() => {
    try {
      return localStorage.getItem(ME_KEY) ?? DEFAULT_CONFIG.team[0].name;
    } catch {
      return DEFAULT_CONFIG.team[0].name;
    }
  });
  const setMe = useCallback((name: string) => {
    setMeState(name);
    try {
      localStorage.setItem(ME_KEY, name);
    } catch {
      /* storage blocked, keep it in memory */
    }
  }, []);
  return (
    <DataProvider store={store} me={me} setMe={setMe}>
      <App />
    </DataProvider>
  );
}

function CloudApp() {
  const sb = supabase!;
  const store = useMemo(() => cloudStore(), []);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [member, setMember] = useState<string | null | undefined>(undefined);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    const email = session?.user.email;
    if (!email) return setMember(undefined);
    void sb
      .from('team_members')
      .select('email, name')
      .then(({ data, error }) => {
        if (error) return setDbError(error.message);
        const row = ((data ?? []) as { email: string; name: string }[]).find((r) => r.email.toLowerCase() === email.toLowerCase());
        setMember(row?.name ?? null);
      });
  }, [sb, session]);

  const signOut = useCallback(() => void sb.auth.signOut(), [sb]);

  if (dbError)
    return (
      <Problem title="Database is not set up" detail={`Supabase answered: ${dbError}`}>
        <p className="muted small">Run supabase/schema.sql in the Supabase SQL Editor, then reload.</p>
        <button type="button" className="btn" onClick={signOut}>
          Sign out
        </button>
      </Problem>
    );
  if (session === undefined || (session && member === undefined)) return <div className="loading">Loading</div>;
  if (!session) return <Login />;
  if (member === null)
    return (
      <div className="login">
        <div className="login-card stack">
          <h1>No access yet</h1>
          <p className="muted">{session.user.email} is not on the team list. Ask an admin to add it, then sign in again.</p>
          <button type="button" className="btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  return (
    <DataProvider store={store} me={member!} email={session.user.email ?? ''} signOut={signOut}>
      <App />
    </DataProvider>
  );
}

function Root() {
  if (configError)
    return (
      <Problem title="Supabase keys need fixing" detail={configError}>
        <p className="muted small">In Netlify: Site configuration, Environment variables. Fix the value, then trigger a new deploy so the build picks it up.</p>
      </Problem>
    );
  if (!supabase) return <PickedUserApp makeStore={localStore} />;
  return requireLogin ? <CloudApp /> : <PickedUserApp makeStore={cloudStore} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <Root />
    </Crash>
  </StrictMode>,
);
