import { useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (!err) return;
    if (err.message === 'Invalid login credentials') setError('Wrong email or password.');
    else if (/fetch|network/i.test(err.message)) setError('Cannot reach the server. Check your internet connection, or the Supabase URL in Netlify.');
    else setError(err.message);
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Builder HQ</span>
        </div>
        <form onSubmit={signIn} className="stack">
          <h1>Sign in</h1>
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <span className="password">
              <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in' : 'Sign in'}
          </button>
          <p className="muted small">Forgot your password? Ask Ali to reset it.</p>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
