export type Platform = 'douyin' | 'bilibili' | 'xiaohongshu';

export type VideoStatus = 'unread' | 'reading' | 'done' | 'starred';

export interface Video {
  id: string;
  platform: Platform;
  url: string;
  title: string;
  author?: string;
  description?: string;
  tags: string[];
  transcript?: string;
  duration?: string;
  coverUrl?: string;
  dateAdded: string;
  summary: string | null;
  keyPoints: string[] | null;
  status: VideoStatus;
  folderId: string | null;
}

/** 新增 / 编辑视频时使用的输入数据（不含系统生成字段） */
export interface VideoInput {
  platform: Platform;
  url: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  transcript: string;
  coverUrl?: string;
  status?: VideoStatus;
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
}

export interface Report {
  id: string;
  title: string;
  date: string;
  videoCount: number;
  platforms: string[];
  tags: string[];
  content: string;
  videoIds: string[];
}

export interface AIConfig {
  id: string;
  name: string;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  isDefault: boolean;
}

export interface Note {
  id: string;
  videoId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** 学习提醒 / 间隔重复 */
export interface Reminder {
  id: string;
  videoId: string;
  videoTitle?: string;
  dueDate: string; // ISO 时间
  intervalDays: number; // 当前间隔天数
  repetition: number; // 已完成复习次数
  status: 'active' | 'snoozed';
  createdAt: string;
  completedAt?: string;
}

export type Page = 'dashboard' | 'library' | 'reports' | 'settings' | 'graph';
