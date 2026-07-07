/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Public site URL used for auth redirects; unset in local dev. */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Font assets imported with Vite's ?url suffix (e.g. the Bravura woff2 we
// inline into the print document's @font-face).
declare module '*.woff2?url' {
  const url: string;
  export default url;
}
