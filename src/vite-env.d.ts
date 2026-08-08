/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID for Drive sign-in (public; see .env.example). */
  readonly VITE_GOOGLE_CLIENT_ID: string;
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
