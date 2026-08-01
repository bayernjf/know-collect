import { supabase, isSupabaseConfigured } from './supabase';
import type { Video, Report, AIConfig, Folder, Note, Reminder } from '../types';

// ─── 辅助：DB 行 ↔ 前端类型转换 ───────────────────────────────

interface VideoRow {
  id: string;
  platform: string;
  url: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  transcript: string;
  duration: string;
  cover_url: string;
  date_added: string;
  summary: string | null;
  key_points: string[] | null;
  status: string;
  folder_id: string | null;
}

function rowToVideo(row: VideoRow): Video {
  return {
    id: row.id,
    platform: row.platform as Video['platform'],
    url: row.url,
    title: row.title,
    author: row.author,
    description: row.description,
    tags: row.tags || [],
    transcript: row.transcript,
    duration: row.duration,
    coverUrl: row.cover_url,
    dateAdded: row.date_added,
    summary: row.summary,
    keyPoints: row.key_points,
    status: (row.status as Video['status']) || 'unread',
    folderId: row.folder_id,
  };
}

function videoToRow(v: Video): Record<string, unknown> {
  return {
    id: v.id,
    platform: v.platform,
    url: v.url,
    title: v.title,
    author: v.author || '',
    description: v.description || '',
    tags: v.tags,
    transcript: v.transcript || '',
    duration: v.duration || '',
    cover_url: v.coverUrl || '',
    date_added: v.dateAdded,
    summary: v.summary,
    key_points: v.keyPoints,
    status: v.status || 'unread',
    folder_id: v.folderId,
  };
}

interface AIConfigRow {
  id: string;
  name: string;
  provider: string;
  api_base_url: string;
  api_key: string;
  model_name: string;
  is_default: boolean;
}

function rowToAIConfig(row: AIConfigRow): AIConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    apiBaseUrl: row.api_base_url,
    apiKey: row.api_key,
    modelName: row.model_name,
    isDefault: row.is_default,
  };
}

interface FolderRow {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

function rowToFolder(row: FolderRow): Folder {
  return { id: row.id, name: row.name, icon: row.icon, sortOrder: row.sort_order };
}

interface NoteRow {
  id: string;
  video_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    videoId: row.video_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ReminderRow {
  id: string;
  video_id: string;
  due_date: string;
  interval_days: number;
  repetition: number;
  status: string;
  created_at: string;
  completed_at?: string;
}

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    videoId: row.video_id,
    dueDate: row.due_date,
    intervalDays: row.interval_days,
    repetition: row.repetition,
    status: (row.status as Reminder['status']) || 'active',
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

// ─── Videos ───────────────────────────────────────────────────

export async function fetchVideos(): Promise<Video[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('date_added', { ascending: false });
  if (error) throw error;
  return (data as VideoRow[]).map(rowToVideo);
}

export async function insertVideo(video: Video): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('videos').insert(videoToRow(video));
  if (error) throw error;
}

export async function updateVideoRow(id: string, fields: Partial<Video>): Promise<void> {
  if (!isSupabaseConfigured) return;
  const row: Record<string, unknown> = {};
  if (fields.title !== undefined) row.title = fields.title;
  if (fields.url !== undefined) row.url = fields.url;
  if (fields.platform !== undefined) row.platform = fields.platform;
  if (fields.author !== undefined) row.author = fields.author;
  if (fields.description !== undefined) row.description = fields.description;
  if (fields.tags !== undefined) row.tags = fields.tags;
  if (fields.transcript !== undefined) row.transcript = fields.transcript;
  if (fields.summary !== undefined) row.summary = fields.summary;
  if (fields.keyPoints !== undefined) row.key_points = fields.keyPoints;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.folderId !== undefined) row.folder_id = fields.folderId;
  row.updated_at = new Date().toISOString();
  const { error } = await supabase.from('videos').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteVideoRow(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteVideoRows(ids: string[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('videos').delete().in('id', ids);
  if (error) throw error;
}

// ─── Reports ──────────────────────────────────────────────────

export async function fetchReports(): Promise<Report[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    videoCount: r.video_count,
    platforms: r.platforms || [],
    tags: r.tags || [],
    content: r.content,
    videoIds: r.video_ids || [],
  }));
}

export async function insertReport(report: Report): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('reports').insert({
    id: report.id,
    title: report.title,
    date: report.date,
    video_count: report.videoCount,
    platforms: report.platforms,
    tags: report.tags,
    content: report.content,
    video_ids: report.videoIds,
  });
  if (error) throw error;
}

export async function deleteReportRow(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
}

// ─── AI Configs ───────────────────────────────────────────────

export async function fetchAIConfigs(): Promise<AIConfig[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('ai_configs')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as AIConfigRow[]).map(rowToAIConfig);
}

export async function insertAIConfig(config: AIConfig): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('ai_configs').insert({
    id: config.id,
    name: config.name,
    provider: config.provider,
    api_base_url: config.apiBaseUrl,
    api_key: config.apiKey,
    model_name: config.modelName,
    is_default: config.isDefault,
  });
  if (error) throw error;
}

export async function updateAIConfigRow(id: string, config: Partial<AIConfig>): Promise<void> {
  if (!isSupabaseConfigured) return;
  const row: Record<string, unknown> = {};
  if (config.name !== undefined) row.name = config.name;
  if (config.provider !== undefined) row.provider = config.provider;
  if (config.apiBaseUrl !== undefined) row.api_base_url = config.apiBaseUrl;
  if (config.apiKey !== undefined) row.api_key = config.apiKey;
  if (config.modelName !== undefined) row.model_name = config.modelName;
  if (config.isDefault !== undefined) row.is_default = config.isDefault;
  row.updated_at = new Date().toISOString();
  const { error } = await supabase.from('ai_configs').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteAIConfigRow(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('ai_configs').delete().eq('id', id);
  if (error) throw error;
}

// ─── Folders ──────────────────────────────────────────────────

export async function fetchFolders(): Promise<Folder[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as FolderRow[]).map(rowToFolder);
}

export async function insertFolder(folder: Folder): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('folders').insert({
    id: folder.id,
    name: folder.name,
    icon: folder.icon,
    sort_order: folder.sortOrder,
  });
  if (error) throw error;
}

export async function updateFolderRow(id: string, fields: Partial<Folder>): Promise<void> {
  if (!isSupabaseConfigured) return;
  const row: Record<string, unknown> = {};
  if (fields.name !== undefined) row.name = fields.name;
  if (fields.icon !== undefined) row.icon = fields.icon;
  if (fields.sortOrder !== undefined) row.sort_order = fields.sortOrder;
  const { error } = await supabase.from('folders').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteFolderRow(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) throw error;
}

// ─── Notes ────────────────────────────────────────────────────

export async function fetchNotes(videoId?: string): Promise<Note[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase.from('notes').select('*').order('created_at', { ascending: false });
  if (videoId) query = query.eq('video_id', videoId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as NoteRow[]).map(rowToNote);
}

export async function insertNote(note: Note): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('notes').insert({
    id: note.id,
    video_id: note.videoId,
    content: note.content,
  });
  if (error) throw error;
}

export async function updateNoteRow(id: string, content: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('notes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNoteRow(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}

// ─── Reminders ────────────────────────────────────────────────

export async function fetchReminders(): Promise<Reminder[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ReminderRow[]).map(rowToReminder);
}

export async function insertReminder(reminder: Reminder): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('reminders').insert({
    id: reminder.id,
    video_id: reminder.videoId,
    due_date: reminder.dueDate,
    interval_days: reminder.intervalDays,
    repetition: reminder.repetition,
    status: reminder.status,
    completed_at: reminder.completedAt,
  });
  if (error) throw error;
}

export async function updateReminderRow(reminder: Reminder): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('reminders')
    .update({
      due_date: reminder.dueDate,
      interval_days: reminder.intervalDays,
      repetition: reminder.repetition,
      status: reminder.status,
      completed_at: reminder.completedAt,
    })
    .eq('id', reminder.id);
  if (error) throw error;
}

export async function deleteReminderRow(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}
