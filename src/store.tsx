import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  loadVideos,
  saveVideos,
  loadReports,
  saveReports,
  loadReminders,
  saveReminders,
} from './storage';
import {
  fetchVideos,
  insertVideo,
  updateVideoRow,
  deleteVideoRow,
  deleteVideoRows,
  fetchReports,
  insertReport,
  deleteReportRow,
  fetchAIConfigs,
  insertAIConfig,
  updateAIConfigRow,
  deleteAIConfigRow,
  fetchFolders,
  insertFolder,
  updateFolderRow,
  deleteFolderRow,
  fetchNotes,
  insertNote,
  updateNoteRow,
  deleteNoteRow,
  fetchReminders,
  insertReminder,
  updateReminderRow,
  deleteReminderRow,
} from './lib/db';
import { isSupabaseConfigured } from './lib/supabase';
import { testAIConnection, type TestConnectionResult } from './lib/ai';
import { platformName } from './utils';
import type { Video, VideoInput, Report, AIConfig, Folder, Note, Reminder, VideoStatus } from './types';

function makeId(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface StoreValue {
  videos: Video[];
  reports: Report[];
  aiConfigs: AIConfig[];
  folders: Folder[];
  notes: Note[];
  reminders: Reminder[];

  addVideo: (input: VideoInput) => Video;
  updateVideo: (id: string, fields: Partial<Video>) => void;
  setVideoStatus: (id: string, status: VideoStatus) => void;
  setVideoFolder: (id: string, folderId: string | null) => void;
  deleteVideo: (id: string) => void;
  deleteVideos: (ids: string[]) => void;

  getDefaultAIConfig: () => AIConfig | null;
  saveSummary: (videoId: string, content: string, keyPoints: string[]) => void;
  createReport: (source?: Video[]) => Report | null;
  addReport: (report: Report) => void;
  createWeeklyReport: () => Report | null;

  addAIConfig: (config: Omit<AIConfig, 'id'>) => void;
  updateAIConfig: (id: string, fields: Partial<AIConfig>) => void;
  deleteAIConfig: (id: string) => void;
  setDefaultAI: (id: string) => void;
  testAI: (config: Omit<AIConfig, 'id'>) => Promise<TestConnectionResult>;

  addFolder: (name: string) => void;
  updateFolder: (id: string, fields: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;

  addNote: (videoId: string, content: string) => void;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;

  addReminder: (videoId: string, initialDays?: number) => void;
  completeReminder: (id: string) => void;
  snoozeReminder: (id: string, days: number) => void;
  deleteReminder: (id: string) => void;
  requestNotificationPermission: () => void;

  deleteReport: (id: string) => void;
  showToast: (message: string, isError?: boolean) => void;
}

export interface ToastItem {
  id: number;
  msg: string;
  isError: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function buildReport(videos: Video[], title: string): Report {
  const platforms = [...new Set(videos.map((v) => v.platform))];
  const tags = [...new Set(videos.flatMap((v) => v.tags))].slice(0, 12);
  const videoIds = videos.map((v) => v.id);
  const lines: string[] = [];
  lines.push(`# ${title}`, '');
  lines.push(
    `> 共收录 ${videos.length} 个视频，覆盖平台：${platforms.map((p) => platformName(p)).join('、') || '—'}`,
    '',
  );
  lines.push('## 📌 核心主题', '');
  if (tags.length === 0) lines.push('- （暂无标签）');
  tags.forEach((t) => lines.push(`- ${t}`));
  lines.push('', '## 🎬 视频清单', '');
  videos.forEach((v, i) => {
    lines.push(`${i + 1}. **${v.title}** （${v.author || '未知作者'}）`);
    if (v.summary) lines.push(`   - ${v.summary.slice(0, 140)}`);
  });
  return {
    id: makeId('rep'),
    title,
    date: new Date().toISOString(),
    videoCount: videos.length,
    platforms,
    tags,
    content: lines.join('\n'),
    videoIds,
  };
}

const SPACING = [1, 2, 4, 7, 15, 30, 60];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<Video[]>(() => loadVideos());
  const [reports, setReports] = useState<Report[]>(() => loadReports());
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>(() => loadReminders());

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const load = async () => {
      try {
        const [sv, sr, sa, sf, sn, srem] = await Promise.all([
          fetchVideos(),
          fetchReports(),
          fetchAIConfigs(),
          fetchFolders(),
          fetchNotes(),
          fetchReminders(),
        ]);
        if (sv.length) setVideos(sv);
        if (sr.length) setReports(sr);
        if (sa.length) setAiConfigs(sa);
        if (sf.length) setFolders(sf);
        if (sn.length) setNotes(sn);
        if (srem.length) setReminders(srem);
      } catch (error) {
        console.error('加载云数据失败:', error);
      }
    };
    load();
  }, []);

  // 浏览器通知：到期提醒
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const now = Date.now();
    const due = reminders.filter((r) => r.status === 'active' && new Date(r.dueDate).getTime() <= now);
    due.forEach((r) => {
      if (!notifiedRef.current.has(r.id)) {
        notifiedRef.current.add(r.id);
        try {
          new Notification('VideoVault 复习提醒', { body: r.videoTitle || '该复习一个视频了' });
        } catch {
          /* ignore */
        }
      }
    });
    const dueIds = new Set(due.map((r) => r.id));
    Array.from(notifiedRef.current).forEach((id) => {
      if (!dueIds.has(id)) notifiedRef.current.delete(id);
    });
  }, [reminders]);

  const showToast = useCallback((message: string, isError = false) => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' toast-error' : '');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }, []);

  // ─── 视频 ─────────────────────────────────────────────────
  const addVideo = useCallback((input: VideoInput): Video => {
    const video: Video = {
      id: makeId(),
      ...input,
      dateAdded: new Date().toISOString().split('T')[0],
      summary: null,
      keyPoints: null,
      status: input.status || 'unread',
      folderId: input.folderId ?? null,
    };
    setVideos((prev) => {
      const next = [video, ...prev];
      saveVideos(next);
      return next;
    });
    insertVideo(video).catch(console.error);
    return video;
  }, []);

  const updateVideo = useCallback((id: string, fields: Partial<Video>) => {
    setVideos((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, ...fields } : v));
      saveVideos(next);
      return next;
    });
    updateVideoRow(id, fields).catch(console.error);
  }, []);

  const setVideoStatus = useCallback(
    (id: string, status: VideoStatus) => updateVideo(id, { status }),
    [updateVideo],
  );

  const setVideoFolder = useCallback(
    (id: string, folderId: string | null) => updateVideo(id, { folderId }),
    [updateVideo],
  );

  const deleteVideo = useCallback((id: string) => {
    setVideos((prev) => {
      const next = prev.filter((v) => v.id !== id);
      saveVideos(next);
      return next;
    });
    deleteVideoRow(id).catch(console.error);
  }, []);

  const deleteVideos = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setVideos((prev) => {
      const next = prev.filter((v) => !idSet.has(v.id));
      saveVideos(next);
      return next;
    });
    deleteVideoRows(ids).catch(console.error);
  }, []);

  // ─── AI 报告（mock 生成 / 由 useAIModals 调用）────────────
  const getDefaultAIConfig = useCallback((): AIConfig | null => {
    return aiConfigs.find((c) => c.isDefault) ?? aiConfigs[0] ?? null;
  }, [aiConfigs]);

  const saveSummary = useCallback(
    (videoId: string, content: string, keyPoints: string[]) => {
      updateVideo(videoId, { summary: content, keyPoints });
    },
    [updateVideo],
  );

  const createReport = useCallback((source?: Video[]): Report | null => {
    const src = source && source.length ? source : videos.filter((v) => v.summary);
    if (src.length === 0) return null;
    return buildReport(src, `VideoVault 综合报告 · ${new Date().toLocaleDateString('zh-CN')}`);
  }, [videos]);

  const createWeeklyReport = useCallback((): Report | null => {
    const weekAgo = Date.now() - 7 * 86400000;
    const week = videos.filter((v) => v.summary && new Date(v.dateAdded).getTime() >= weekAgo);
    if (week.length === 0) return null;
    return buildReport(week, `VideoVault 周报 · ${new Date().toLocaleDateString('zh-CN')}`);
  }, [videos]);

  const addReport = useCallback((report: Report) => {
    setReports((prev) => {
      const next = [report, ...prev];
      saveReports(next);
      return next;
    });
    insertReport(report).catch(console.error);
  }, []);

  const deleteReport = useCallback((id: string) => {
    setReports((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveReports(next);
      return next;
    });
    deleteReportRow(id).catch(console.error);
  }, []);

  // ─── AI 配置 ──────────────────────────────────────────────
  const addAIConfig = useCallback((config: Omit<AIConfig, 'id'>) => {
    const full: AIConfig = { ...config, id: makeId() };
    setAiConfigs((prev) => {
      const next = full.isDefault
        ? [...prev.map((c) => ({ ...c, isDefault: false })), full]
        : [full, ...prev];
      return next;
    });
    insertAIConfig(full).catch(console.error);
  }, []);

  const updateAIConfig = useCallback((id: string, fields: Partial<AIConfig>) => {
    setAiConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...fields, isDefault: fields.isDefault ?? c.isDefault } : c)),
    );
    updateAIConfigRow(id, fields).catch(console.error);
  }, []);

  const deleteAIConfig = useCallback((id: string) => {
    setAiConfigs((prev) => prev.filter((c) => c.id !== id));
    deleteAIConfigRow(id).catch(console.error);
  }, []);

  const setDefaultAI = useCallback((id: string) => {
    setAiConfigs((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    updateAIConfigRow(id, { isDefault: true }).catch(console.error);
  }, []);

  const testAI = useCallback(async (config: Omit<AIConfig, 'id'>) => {
    return testAIConnection(config);
  }, []);

  // ─── 文件夹 ───────────────────────────────────────────────
  const addFolder = useCallback(
    (name: string) => {
      const folder: Folder = {
        id: makeId('fol'),
        name,
        icon: '📁',
        sortOrder: folders.length,
      };
      setFolders((prev) => [...prev, folder].sort((a, b) => a.sortOrder - b.sortOrder));
      insertFolder(folder).catch(console.error);
    },
    [folders],
  );

  const updateFolder = useCallback((id: string, fields: Partial<Folder>) => {
    setFolders((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, ...fields } : f));
      next.sort((a, b) => a.sortOrder - b.sortOrder);
      return next;
    });
    updateFolderRow(id, fields).catch(console.error);
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    deleteFolderRow(id).catch(console.error);
  }, []);

  // ─── 笔记 ─────────────────────────────────────────────────
  const addNote = useCallback((videoId: string, content: string) => {
    const note: Note = {
      id: makeId('note'),
      videoId,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    insertNote(note).catch(console.error);
  }, []);

  const updateNote = useCallback((id: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n)),
    );
    updateNoteRow(id, content).catch(console.error);
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    deleteNoteRow(id).catch(console.error);
  }, []);

  // ─── 提醒（间隔重复）──────────────────────────────────────
  const addReminder = useCallback(
    (videoId: string, initialDays = 1) => {
      const video = videos.find((v) => v.id === videoId);
      const now = Date.now();
      const reminder: Reminder = {
        id: makeId('rem'),
        videoId,
        videoTitle: video?.title,
        dueDate: new Date(now + initialDays * 86400000).toISOString(),
        intervalDays: initialDays,
        repetition: 0,
        status: 'active',
        createdAt: new Date(now).toISOString(),
      };
      setReminders((prev) => {
        const next = [reminder, ...prev];
        saveReminders(next);
        return next;
      });
      insertReminder(reminder).catch(console.error);
    },
    [videos],
  );

  const completeReminder = useCallback((id: string) => {
    let updated: Reminder | undefined;
    setReminders((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r;
        const repetition = r.repetition + 1;
        const intervalDays = SPACING[Math.min(repetition, SPACING.length - 1)];
        updated = {
          ...r,
          repetition,
          intervalDays,
          dueDate: new Date(Date.now() + intervalDays * 86400000).toISOString(),
          status: 'active',
          completedAt: new Date().toISOString(),
        };
        return updated;
      });
      saveReminders(next);
      return next;
    });
    if (updated) updateReminderRow(updated).catch(console.error);
  }, []);

  const snoozeReminder = useCallback((id: string, days: number) => {
    let updated: Reminder | undefined;
    setReminders((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, status: 'active', dueDate: new Date(Date.now() + days * 86400000).toISOString() };
        return updated;
      });
      saveReminders(next);
      return next;
    });
    if (updated) updateReminderRow(updated).catch(console.error);
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setReminders((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveReminders(next);
      return next;
    });
    deleteReminderRow(id).catch(console.error);
  }, []);

  const requestNotificationPermission = useCallback(() => {
    if (typeof Notification === 'undefined') {
      showToast('当前浏览器不支持通知', true);
      return;
    }
    if (Notification.permission === 'granted') {
      showToast('通知已开启 🔔');
      return;
    }
    Notification.requestPermission().then((p) => {
      showToast(p === 'granted' ? '已开启复习提醒通知 🔔' : '通知未授权');
    });
  }, [showToast]);

  const value: StoreValue = {
    videos,
    reports,
    aiConfigs,
    folders,
    notes,
    reminders,
    addVideo,
    updateVideo,
    setVideoStatus,
    setVideoFolder,
    deleteVideo,
    deleteVideos,
    getDefaultAIConfig,
    saveSummary,
    createReport,
    addReport,
    createWeeklyReport,
    addAIConfig,
    updateAIConfig,
    deleteAIConfig,
    setDefaultAI,
    testAI,
    addFolder,
    updateFolder,
    deleteFolder,
    addNote,
    updateNote,
    deleteNote,
    addReminder,
    completeReminder,
    snoozeReminder,
    deleteReminder,
    requestNotificationPermission,
    deleteReport,
    showToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
