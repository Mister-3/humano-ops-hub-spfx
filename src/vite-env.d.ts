/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_USER_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
