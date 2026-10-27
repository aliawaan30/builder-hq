/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "true" turns the login screen on. Also run supabase/lock.sql. */
  readonly VITE_REQUIRE_LOGIN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
