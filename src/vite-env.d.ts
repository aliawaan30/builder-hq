/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "true" skips login. Needs supabase/open-access.sql. */
  readonly VITE_OPEN_ACCESS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
