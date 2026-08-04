/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base (origin + /api/v2 prefix) for split deploys. Empty/unset ⇒ same-origin /api/v2. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
