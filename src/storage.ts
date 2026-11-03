import type { Video, Report, Reminder, Folder, Note, AIConfig } from './types';

const STORAGE_KEY = 'videovault_data';
const REPORT_KEY = 'videovault_reports';
const REMINDER_KEY = 'videovault_reminders';
const FOLDER_KEY = 'videovault_folders';
const NOTE_KEY = 'videovault_notes';
const AI_CONFIG_KEY = 'videovault_aiconfigs';

function loadList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export function loadVideos(): Video[] {
  return loadList(STORAGE_KEY);
}

export function saveVideos(videos: Video[]): void {
  saveList(STORAGE_KEY, videos);
}

export function loadReports(): Report[] {
  return loadList(REPORT_KEY);
}

export function saveReports(reports: Report[]): void {
  saveList(REPORT_KEY, reports);
}

export function loadReminders(): Reminder[] {
  return loadList(REMINDER_KEY);
}

export function saveReminders(reminders: Reminder[]): void {
  saveList(REMINDER_KEY, reminders);
}

export function loadFolders(): Folder[] {
  return loadList(FOLDER_KEY);
}

export function saveFolders(folders: Folder[]): void {
  saveList(FOLDER_KEY, folders);
}

export function loadNotes(): Note[] {
  return loadList(NOTE_KEY);
}

export function saveNotes(notes: Note[]): void {
  saveList(NOTE_KEY, notes);
}

export function loadAIConfigs(): AIConfig[] {
  return loadList(AI_CONFIG_KEY);
}

export function saveAIConfigs(configs: AIConfig[]): void {
  saveList(AI_CONFIG_KEY, configs);
}

// ─── 本地数据的账号归属 ─────────────────────────────────────
// localStorage 是浏览器级共享的；多账号场景下必须防止 A 的缓存被 B 看到或上行。
const USER_KEY = 'videovault_user';

const ALL_DATA_KEYS = [STORAGE_KEY, REPORT_KEY, REMINDER_KEY, FOLDER_KEY, NOTE_KEY, AI_CONFIG_KEY];

export function getStoredUserId(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserId(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(USER_KEY, userId);
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAllLocalData(): void {
  for (const key of ALL_DATA_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
