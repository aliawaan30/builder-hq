import { useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError('That code did not work. Check the latest email or send a new one.');
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Builder HQ</span>
        </div>
        {!sent ? (
          <form onSubmit={send} className="stack">
            <h1>Sign in</h1>
            <p className="muted">We will email you a sign in code.</p>
            <label className="field">
              <span className="field-label">Work email</span>
              <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack">
            <h1>Check your email</h1>
            <p className="muted">Enter the code sent to {email}, or open the link in that email.</p>
            <label className="field">
              <span className="field-label">Code</span>
              <input inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Checking' : 'Sign in'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
