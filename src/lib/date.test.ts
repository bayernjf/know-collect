import { describe, expect, it } from 'vitest';
import { formatLocalDate } from './date';

const probe = new Date('2026-11-02T16:30:00.000Z');
// npm test 固定 TZ=Asia/Shanghai；其他时区下跳过这条时区回归用例。
const RUNS_IN_UTC_PLUS_8 = probe.getDate() === 3 && probe.getHours() === 0;

describe('formatLocalDate', () => {
  it('pads month and day', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatLocalDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  describe.runIf(RUNS_IN_UTC_PLUS_8)('UTC+8 regression', () => {
    it('uses the local calendar day, not the UTC day', () => {
      // UTC 仍是 11-02，但本地已是 11-03 00:30；旧实现会落到 11-02。
      expect(probe.toISOString().slice(0, 10)).toBe('2026-11-02');
      expect(formatLocalDate(probe)).toBe('2026-11-03');
    });
  });
});
