import { Component, type ErrorInfo, type ReactNode } from 'react';

export function Problem({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <div className="login">
      <div className="login-card stack">
        <h1>{title}</h1>
        <p className="muted">{detail}</p>
        {children}
      </div>
    </div>
  );
}

interface State {
  error: Error | null;
}

/** Shows the error instead of a blank screen. */
export class Crash extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Builder HQ crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Problem title="Something broke" detail="The app hit an error. Your saved data is safe. Reload to try again, and send this message to Ali if it keeps happening.">
        <pre className="crash">{error.message}</pre>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </Problem>
    );
  }
}
