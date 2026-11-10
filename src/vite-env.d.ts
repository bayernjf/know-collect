/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_METADATA_PROXY_URL?: string;
  /** AI Key 静态加密密钥；缺失时保存会被拒绝（fail-closed）。 */
  readonly VITE_AI_KEY_ENC_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
