import { useEffect, useRef, useState } from 'react';
import { ClockBar } from './components/DayStrip';
import { EditorProvider, useEditor } from './components/Editor';
import { Avatar, Icon, type IconName } from './components/ui';
import { useData } from './lib/data';
import { newTask } from './lib/factory';
import { isTyping, useView, type View } from './lib/hooks';
import { normalizeConfig } from './lib/config';
import type { DB } from './lib/types';
import { useConfig } from './lib/useConfig';
import { Board } from './views/Board';
import { Clients } from './views/Clients';
import { Meetings } from './views/Meetings';
import { Setup } from './views/Setup';
import { Today } from './views/Today';

const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'meetings', label: 'Meetings', icon: 'meetings' },
  { id: 'clients', label: 'Clients', icon: 'clients' },
  { id: 'setup', label: 'Setup', icon: 'setup' },
];

export function App() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  );
}

function Shell() {
  const [view, go] = useView();
  const { me, db, ready } = useData();
  const open = useEditor();
  const { workstreams } = useConfig();
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n') {
        e.preventDefault();
        open({ kind: 'task', isNew: true, row: newTask({ owner: me, workstream: workstreams[0].id }) });
      }
      const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (idx >= 0) go(NAV[idx].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, me, go, workstreams]);

  const openCount = db.tasks.filter((t) => t.owner === me && (t.status === 'doing' || t.status === 'next')).length;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Builder HQ</span>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((n, i) => (
            <a key={n.id} href={`#${n.id}`} className={view === n.id ? 'is-on' : ''} aria-current={view === n.id ? 'page' : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.id === 'board' && openCount > 0 && <span className="nav-n">{openCount}</span>}
              <kbd>{i + 1}</kbd>
            </a>
          ))}
        </nav>
        <button type="button" className="me" onClick={() => setSettings(true)}>
          <Avatar name={me} size={26} />
          <span>{me}</span>
          <Icon name="settings" size={16} />
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <ClockBar />
        </div>
        {!ready ? <div className="loading">Loading</div> : view === 'board' ? <Board /> : view === 'meetings' ? <Meetings /> : view === 'clients' ? <Clients /> : view === 'setup' ? <Setup /> : <Today />}
      </main>

      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  );
}

function Settings({ onClose }: { onClose: () => void }) {
  const { mode, me, setMe, signOut, db, config, importDb, saveConfig, toast } = useData();
  const { team } = useConfig();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const exportDb = () => {
    const blob = new Blob([JSON.stringify({ ...db, config }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `builder-hq-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as DB & { config?: unknown };
      if (!Array.isArray(data.tasks) || !Array.isArray(data.meetings) || !Array.isArray(data.clients)) throw new Error('bad shape');
      if (data.config && mode === 'local') await saveConfig(normalizeConfig(data.config));
      await importDb(data);
      onClose();
    } catch {
      toast('That file is not a Builder HQ backup');
    }
  };

  return (
    <div className="modal-wrap">
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="drawer-head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">
          <p className="muted">
            {mode === 'cloud'
              ? 'Synced with Supabase. Changes show up for the whole team straight away.'
              : 'Local mode. Data stays in this browser. Add Supabase keys to share it with the team.'}
          </p>
          {setMe && (
            <label className="field">
              <span className="field-label">You are</span>
              <select value={me} onChange={(e) => setMe(e.target.value)}>
                {team.map((m) => (
                  <option key={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="row-gap">
            <button type="button" className="btn" onClick={exportDb}>
              Download backup
            </button>
            <button type="button" className="btn" onClick={() => file.current?.click()}>
              Restore backup
            </button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          <p className="muted small">Shortcuts: N new task, 1 to 5 switch pages, slash search on the board, Esc closes panels.</p>
          {signOut && (
            <button type="button" className="btn btn-danger" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
