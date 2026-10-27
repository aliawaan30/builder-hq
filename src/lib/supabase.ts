import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** Set when keys exist but are unusable, so the app can explain instead of crashing. */
export let configError: string | null = null;

function connect(): SupabaseClient | null {
  if (!url && !key) return null;
  if (!url || !key) {
    configError = `VITE_SUPABASE_${url ? 'ANON_KEY' : 'URL'} is missing. Set both, or neither for local mode.`;
    return null;
  }
  if (!/^https:\/\/[^\s/]+/.test(url)) {
    configError = `VITE_SUPABASE_URL must start with https://, for example https://abcd.supabase.co. It is currently "${url}".`;
    return null;
  }
  try {
    return createClient(url, key);
  } catch (e) {
    configError = `Supabase could not start: ${e instanceof Error ? e.message : String(e)}`;
    return null;
  }
}

/** Null when keys are missing or invalid. Missing keys mean local mode. */
export const supabase: SupabaseClient | null = connect();
