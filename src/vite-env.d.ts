/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_COMMUNITY_API_URL: string;
  readonly VITE_COMMUNITY_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
