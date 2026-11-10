import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_KEY_ENV_NAME,
  AiKeyEncryptionError,
  decryptApiKey,
  encryptApiKey,
  isAiKeyEncryptionConfigured,
  isEncryptedApiKey,
} from './crypto';

// 所有假值都在运行时拼接，仓库里不出现任何可被误认为真实密钥的字面量。
function fakeValue(label: string): string {
  return [label, Date.now().toString(36), Math.random().toString(36).slice(2)].join('-');
}

const FAKE_SECRET = fakeValue('unit-test-secret');
const FAKE_KEY = fakeValue('unit-test-api-key');

beforeEach(() => {
  vi.stubEnv(AI_KEY_ENV_NAME, FAKE_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('key configuration', () => {
  it('reports configured when the secret is present', () => {
    expect(isAiKeyEncryptionConfigured()).toBe(true);
  });

  it('fails closed when the secret is missing and never leaks the plaintext', async () => {
    vi.stubEnv(AI_KEY_ENV_NAME, '');
    expect(isAiKeyEncryptionConfigured()).toBe(false);

    const error = await encryptApiKey(FAKE_KEY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiKeyEncryptionError);
    expect((error as Error).message).toContain(AI_KEY_ENV_NAME);
    expect((error as Error).message).not.toContain(FAKE_KEY);
  });
});

describe('encrypt / decrypt', () => {
  it('produces a versioned ciphertext that hides the plaintext', async () => {
    const stored = await encryptApiKey(FAKE_KEY);
    expect(isEncryptedApiKey(stored)).toBe(true);
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(stored).not.toContain(FAKE_KEY);
    expect(await decryptApiKey(stored)).toBe(FAKE_KEY);
  });

  it('does not re-encrypt an already encrypted value (backfill idempotency)', async () => {
    const stored = await encryptApiKey(FAKE_KEY);
    expect(await encryptApiKey(stored)).toBe(stored);
  });

  it('still reads legacy plaintext rows before they are backfilled', async () => {
    expect(await decryptApiKey(FAKE_KEY)).toBe(FAKE_KEY);
  });

  it('throws without leaking material when the secret does not match', async () => {
    const stored = await encryptApiKey(FAKE_KEY);
    vi.stubEnv(AI_KEY_ENV_NAME, fakeValue('other-secret'));
    const error = await decryptApiKey(stored).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiKeyEncryptionError);
    expect((error as Error).message).not.toContain(FAKE_KEY);
  });

  it('skips encrypted rows on a second backfill pass', async () => {
    const rows = [
      { api_key: fakeValue('row-a') },
      { api_key: fakeValue('row-b') },
      { api_key: await encryptApiKey(fakeValue('row-c')) },
    ];
    const runBackfill = async (): Promise<number> => {
      let migrated = 0;
      for (const row of rows) {
        if (!isEncryptedApiKey(row.api_key)) {
          row.api_key = await encryptApiKey(row.api_key);
          migrated += 1;
        }
      }
      return migrated;
    };

    expect(await runBackfill()).toBe(2);
    expect(await runBackfill()).toBe(0);
    for (const row of rows) {
      expect(await decryptApiKey(row.api_key)).toMatch(/^row-/);
    }
  });
});
