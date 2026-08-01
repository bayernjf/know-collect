import type { Platform, Video, VideoInput } from '../types';

/**
 * 解析 CSV 文本，返回 VideoInput 数组。
 * 支持的列：title, platform, url, author, description, tags, status, dateAdded
 * 第一行为表头。
 */
export function parseCSV(text: string): VideoInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const results: VideoInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] || '').trim();
    });

    const platform = normalizePlatform(row['platform']);
    if (!row['title'] || !row['url']) continue;

    results.push({
      platform,
      url: row['url'],
      title: row['title'],
      author: row['author'] || '',
      description: row['description'] || '',
      tags: row['tags']
        ? row['tags']
            .split(/[,;|]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      transcript: '',
      status: (row['status'] as VideoInput['status']) || 'unread',
    });
  }
  return results;
}

/**
 * 解析 JSON 备份文件，提取 videos 数组
 */
export function parseJSONBackup(text: string): VideoInput[] {
  try {
    const data = JSON.parse(text);
    const videos: Video[] = Array.isArray(data) ? data : data.videos || [];
    return videos.map((v: Video) => ({
      platform: v.platform || 'bilibili',
      url: v.url || '',
      title: v.title || '未命名',
      author: v.author || '',
      description: v.description || '',
      tags: v.tags || [],
      transcript: v.transcript || '',
      status: v.status || 'unread',
      folderId: v.folderId || null,
    }));
  } catch {
    return [];
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function normalizePlatform(raw: string): Platform {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('douyin') || lower.includes('抖音')) return 'douyin';
  if (lower.includes('bilibili') || lower.includes('b站') || lower.includes('bili')) return 'bilibili';
  if (lower.includes('xiaohongshu') || lower.includes('小红书') || lower.includes('xhs')) return 'xiaohongshu';
  return 'bilibili';
}
