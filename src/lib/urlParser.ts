import type { Platform } from '../types';

export interface ParsedVideoUrl {
  platform: Platform;
  videoId: string | null;
  originalUrl: string;
}

export interface Metadata {
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  duration?: string;
}

export function detectPlatform(url: string): Platform | null {
  const u = url.toLowerCase();
  if (u.includes('douyin.com') || u.includes('iesdouyin.com')) return 'douyin';
  if (u.includes('bilibili.com') || u.includes('b23.tv')) return 'bilibili';
  if (u.includes('xiaohongshu.com') || u.includes('xhslink.com')) return 'xiaohongshu';
  return null;
}

export function parseVideoUrl(url: string): ParsedVideoUrl | null {
  const platform = detectPlatform(url);
  if (!platform) return null;

  let videoId: string | null = null;
  if (platform === 'bilibili') {
    // https://www.bilibili.com/video/BV1xx... 或 ?bvid=BV1...
    const bv = url.match(/BV[0-9A-Za-z]+/);
    const av = url.match(/av(\d+)/i);
    if (bv) videoId = bv[0];
    else if (av) videoId = 'av' + av[1];
  } else if (platform === 'douyin') {
    const m =
      url.match(/(?:video|note)\/(\w+)/) || url.match(/douyin\.com\/(\w+)/);
    if (m) videoId = m[1];
  } else if (platform === 'xiaohongshu') {
    const m =
      url.match(/explore\/(\w+)/) ||
      url.match(/discovery\/item\/(\w+)/) ||
      url.match(/xiaohongshu\.com\/(\w+)/) ||
      url.match(/xhslink\.com\/(\w+)/);
    if (m) videoId = m[1];
  }
  return { platform, videoId, originalUrl: url };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── 元数据抓取代理 ───────────────────────────────────────────
// 浏览器直连抖音/小红书受 CORS 限制。优先走代理：
//   1) 生产：VITE_METADATA_PROXY_URL（如 Supabase Edge Function）
//   2) 开发：Vite dev server 的 /api/meta 中间件（服务端抓取）
const METADATA_PROXY = import.meta.env.VITE_METADATA_PROXY_URL as string | undefined;
const USE_DEV_PROXY = import.meta.env.DEV;

async function fetchMetaViaProxy(
  url: string,
): Promise<{ title?: string; author?: string; description?: string; coverUrl?: string } | null> {
  const base = METADATA_PROXY || (USE_DEV_PROXY ? '/api/meta' : '');
  if (!base) return null;
  try {
    const resp = await fetch(`${base}?url=${encodeURIComponent(url)}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function fetchBilibiliMeta(parsed: ParsedVideoUrl): Promise<Metadata | null> {
  if (!parsed.videoId || !parsed.videoId.startsWith('BV')) return null;
  try {
    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${parsed.videoId}`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.code === 0 && data.data) {
      const d = data.data;
      return {
        title: d.title,
        author: d.owner?.name || '',
        description: d.desc || '',
        coverUrl: d.pic || '',
        duration: formatDuration(d.duration || 0),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchVideoMeta(
  url: string,
  showToast?: (msg: string, isError?: boolean) => void,
): Promise<Metadata | null> {
  const parsed = parseVideoUrl(url);
  if (!parsed) return null;

  const useProxy = !!METADATA_PROXY || USE_DEV_PROXY;
  if (useProxy) {
    const m = await fetchMetaViaProxy(url);
    if (m && m.title) {
      return {
        title: m.title,
        author: m.author || '',
        description: m.description || '',
        coverUrl: m.coverUrl || '',
      };
    }
    if (parsed.platform === 'bilibili') {
      const b = await fetchBilibiliMeta(parsed);
      if (b) return b;
    }
    showToast?.('未能抓取链接元数据，已自动识别平台，请补全标题等信息', true);
    return { title: '', author: '', description: '', coverUrl: '' };
  }

  if (parsed.platform === 'bilibili') {
    return fetchBilibiliMeta(parsed);
  }
  showToast?.('抖音/小红书链接受 CORS 限制，请在设置中配置「元数据代理」后再试', true);
  return null;
}
