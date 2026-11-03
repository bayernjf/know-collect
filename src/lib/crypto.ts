/**
 * AI API Key 静态加密（AES-GCM）。
 *
 * 存储格式：`enc:v1:<base64(iv)>:<base64(ciphertext)>`
 * - `enc:v1:` 既是版本标记，也是“已加密”判定依据；回填时据此跳过已加密记录，
 *   因此回填与重复加密都是幂等的。
 * - 密钥只来自环境变量 `VITE_AI_KEY_ENC_SECRET`。缺失时加密与解密都抛错，
 *   调用方必须 fail-closed（拒绝写入），绝不降级为明文。
 * - 抛出的错误信息只说明原因，永远不包含明文或密文。
 */

export const AI_KEY_ENV_NAME = 'VITE_AI_KEY_ENC_SECRET';

const ENCRYPTED_PREFIX = 'enc:v1:';
const KEY_ENV_NAME = AI_KEY_ENV_NAME;

export class AiKeyEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiKeyEncryptionError';
  }
}

function readSecret(): string | null {
  const raw = import.meta.env.VITE_AI_KEY_ENC_SECRET;
  const secret = typeof raw === 'string' ? raw.trim() : '';
  return secret.length > 0 ? secret : null;
}

/** 是否配置了加密密钥；UI 与写入路径据此决定是否允许保存。 */
export function isAiKeyEncryptionConfigured(): boolean {
  return readSecret() !== null;
}

/** 值是否已是本模块的密文格式（用于回填判重，避免重复加密）。 */
export function isEncryptedApiKey(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = readSecret();
  if (!secret) {
    throw new AiKeyEncryptionError(
      `AI Key 加密未配置：缺少环境变量 ${KEY_ENV_NAME}，已拒绝以明文形式保存`,
    );
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 加密 API Key；已是密文时原样返回（幂等）。 */
export async function encryptApiKey(plain: string): Promise<string> {
  if (isEncryptedApiKey(plain)) return plain;
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${ENCRYPTED_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

/**
 * 解密 API Key。
 * - 未带前缀的历史明文原样返回，保证回填前旧数据仍可用；
 * - 密文但密钥缺失或密钥不匹配时抛错（不返回密文，避免把密文当 Key 使用）。
 */
export async function decryptApiKey(stored: string): Promise<string> {
  if (!isEncryptedApiKey(stored)) return stored;
  const payload = stored.slice(ENCRYPTED_PREFIX.length);
  const separator = payload.indexOf(':');
  if (separator < 0) {
    throw new AiKeyEncryptionError('AI Key 解密失败：密文格式无效');
  }
  const iv = payload.slice(0, separator);
  const data = payload.slice(separator + 1);
  if (!iv || !data) {
    throw new AiKeyEncryptionError('AI Key 解密失败：密文格式无效');
  }
  const key = await getCryptoKey();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(iv) },
      key,
      base64ToBytes(data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new AiKeyEncryptionError('AI Key 解密失败：密钥不匹配或密文已损坏');
  }
}
