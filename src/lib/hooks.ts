import { useEffect, useState } from 'react';

export type View = 'today' | 'board' | 'meetings' | 'clients' | 'setup';
const VIEWS: View[] = ['today', 'board', 'meetings', 'clients', 'setup'];

const readHash = (): View => {
  const h = window.location.hash.replace('#', '') as View;
  return VIEWS.includes(h) ? h : 'today';
};

export function useView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(readHash);
  useEffect(() => {
    const on = () => setView(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [view, (v) => (window.location.hash = v)];
}

export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** True when focus is in a text field, so single key shortcuts stay out of the way. */
export const isTyping = (): boolean => {
  const el = document.activeElement as HTMLElement | null;
  if (document.querySelector('[role="dialog"]')) return true;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};
