import type { Video, Report, Reminder } from './types';

const STORAGE_KEY = 'videovault_data';
const REPORT_KEY = 'videovault_reports';
const REMINDER_KEY = 'videovault_reminders';

export function loadVideos(): Video[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Video[]) : [];
  } catch {
    return [];
  }
}

export function saveVideos(videos: Video[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}

export function loadReports(): Report[] {
  try {
    const raw = localStorage.getItem(REPORT_KEY);
    return raw ? (JSON.parse(raw) as Report[]) : [];
  } catch {
    return [];
  }
}

export function saveReports(reports: Report[]): void {
  localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
}

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    return raw ? (JSON.parse(raw) as Reminder[]) : [];
  } catch {
    return [];
  }
}

export function saveReminders(reminders: Reminder[]): void {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders));
}
