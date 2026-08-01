import type { Platform } from './types';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function platformName(p: Platform): string {
  return p === 'douyin' ? '抖音' : p === 'bilibili' ? 'B站' : '小红书';
}

export function platformIcon(p: Platform): string {
  return p === 'douyin' ? '🎵' : p === 'bilibili' ? '📺' : '📕';
}

export function exportData(videos: unknown[], reports: unknown[]): void {
  const data = { videos, reports, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `videovault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}
