import { detectPlatform } from './urlParser';
import type { VideoInput, Platform } from '../types';

/**
 * 从 Notion 数据库导入收藏。
 * 需要：Notion 集成 Token（Internal Integration Secret）+ 已共享给该集成的数据库 ID。
 * 支持自动识别属性类型：title / url / rich_text / select / multi_select。
 */
export async function fetchNotionVideos(
  token: string,
  databaseId: string,
  onProgress?: (done: number) => void,
): Promise<VideoInput[]> {
  const out: VideoInput[] = [];
  let startCursor: string | undefined;

  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(startCursor ? { start_cursor: startCursor } : {}),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Notion API 错误 ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { results: any[]; has_more: boolean; next_cursor?: string };
    for (const page of data.results) {
      const v = mapNotionPage(page);
      if (v) out.push(v);
    }
    onProgress?.(out.length);
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return out;
}

function mapNotionPage(page: any): VideoInput | null {
  const props = page.properties || {};
  let title = '';
  let url = '';
  let author = '';
  let description = '';
  const tags: string[] = [];

  for (const key of Object.keys(props)) {
    const p = props[key];
    switch (p.type) {
      case 'title':
        title = (p.title || []).map((t: any) => t.plain_text).join('');
        break;
      case 'url':
        url = p.url || '';
        break;
      case 'rich_text': {
        const txt = (p.rich_text || []).map((t: any) => t.plain_text).join('');
        if (!author) author = txt;
        else if (!description) description = txt;
        break;
      }
      case 'multi_select':
        (p.multi_select || []).forEach((m: any) => tags.push(m.name));
        break;
      case 'select':
        if (p.select?.name) tags.push(p.select.name);
        break;
      default:
        break;
    }
  }

  if (!url && !title) return null;
  const platform: Platform = url ? detectPlatform(url) ?? 'douyin' : 'douyin';
  return {
    platform,
    url: url || '',
    title: title || url || '未命名',
    author,
    description,
    tags,
    transcript: '',
  };
}
