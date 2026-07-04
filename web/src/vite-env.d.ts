/// <reference types="vite/client" />

// Font assets imported with Vite's ?url suffix (e.g. the Bravura woff2 we
// inline into the print document's @font-face).
declare module '*.woff2?url' {
  const url: string;
  export default url;
}
