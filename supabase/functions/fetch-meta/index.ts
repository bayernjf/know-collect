// Supabase Edge Function (Deno)
// 服务端抓取视频页元数据，规避浏览器 CORS。部署：supabase functions deploy fetch-meta
//
// 安全约束（防开放代理 / SSRF）：
// 1. 必须携带有效用户 JWT（Authorization: Bearer），匿名一律 401。
// 2. 目标仅允许 http/https；DNS 解析后逐 IP 校验，拒绝环回、私有网段、
//    链路本地（含云元数据 169.254.169.254）、保留段；重定向逐跳重新校验。
// 3. 最多 3 次重定向、10s 超时、响应体最大 1MB。
// 4. CORS 收紧到 ALLOWED_ORIGINS（函数环境变量，逗号分隔）。
//
// 残余风险说明：DNS 校验与实际 fetch 之间存在 TOCTOU 窗口（防 DNS rebinding
// 的完全方案需要按已校验 IP 直连并固定 Host/SNI，Edge Runtime 不支持自定义
// 连接目标），此处采用"解析即校验 + 逐跳重校验"的最佳努力方案。
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

// ─── 配置 ────────────────────────────────────────────────────
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_048_576; // 1MB

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// 移动端 UA：让抖音/小红书等服务端返回带 OG 元数据的 SSR 页面（桌面端常为 SPA 空壳）
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

// ─── CORS（收紧到自有域名）───────────────────────────────────
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
  }
  // 未匹配来源不回显 CORS 头：浏览器会拦截跨域读取，服务端仍正常响应（curl 等不受影响，但鉴权拦在前面）
  return {};
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  });
}

// ─── JWT 鉴权 ────────────────────────────────────────────────
async function requireUser(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return false;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return false;
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      signal: AbortSignal.timeout(5_000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ─── SSRF 目标校验 ───────────────────────────────────────────
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10/8 私有
    a === 127 || // 环回
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // 链路本地（含云元数据 169.254.169.254）
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 私有
    (a === 192 && b === 168) || // 192.168/16 私有
    (a === 192 && b === 0) || // 192.0.0.0/24 / 192.0.2.0/24 保留
    (a === 198 && (b === 18 || b === 19)) || // 198.18/15 基准测试段
    (a === 198 && b === 51) || // 198.51.100/24 文档段
    (a === 203 && b === 0) || // 203.0.113/24 文档段
    a >= 224 // 组播 224/4 + 保留 240/4
  );
}

/** 展开 IPv6 为 8 个 16 位组；解析失败返回 null。 */
function parseIpv6Groups(ip: string): number[] | null {
  const normalized = ip.toLowerCase();
  if (normalized.includes('.')) {
    // 混合写法（::ffff:1.2.3.4）：把尾部 IPv4 换成两组 hex 再解析
    const lastColon = normalized.lastIndexOf(':');
    const v4 = normalized.slice(lastColon + 1);
    const parts = v4.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = ((parts[0] << 8) | parts[1]).toString(16);
    const lo = ((parts[2] << 8) | parts[3]).toString(16);
    return parseIpv6Groups(`${normalized.slice(0, lastColon)}:${hi}:${lo}`);
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (left.length + right.length > 8) return null;
  if (halves.length === 1 && left.length !== 8) return null;
  const fill = 8 - left.length - right.length;
  const groups = [...left, ...Array<string>(fill).fill('0'), ...right];
  const parsed = groups.map((g) => parseInt(g, 16));
  if (parsed.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return parsed;
}

function isBlockedIpv6(ip: string): boolean {
  const groups = parseIpv6Groups(ip);
  if (!groups) return true; // 解析不了的一律拒绝
  // IPv4-mapped（::ffff:0:0/96）与 NAT64（64:ff9b::/96）：按映射出的 IPv4 校验
  const isMapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  const isNat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
  if (isMapped || isNat64) {
    const v4 = `${(groups[6] >> 8) & 0xff}.${groups[6] & 0xff}.${(groups[7] >> 8) & 0xff}.${groups[7] & 0xff}`;
    return isBlockedIpv4(v4);
  }
  if (groups.every((g) => g === 0)) return true; // :: 未指定
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1 环回
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 链路本地
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 组播
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // 2001:db8::/32 文档段
  return false;
}

function isBlockedIp(ip: string): boolean {
  return ip.includes(':') ? isBlockedIpv6(ip) : isBlockedIpv4(ip);
}

async function resolveHostIps(hostname: string): Promise<string[]> {
  const ips: string[] = [];
  for (const recordType of ['A', 'AAAA'] as const) {
    try {
      const records = await Deno.resolveDns(hostname, recordType);
      ips.push(...records);
    } catch {
      // 无该类型记录时 Deno 抛错，忽略
    }
  }
  return ips;
}

/** 校验目标 URL：协议白名单 + IP 字面量/解析 IP 网段校验。返回 null 表示合法。 */
async function assertPublicHttpUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // 去掉 IPv6 字面量括号
  // hostname 是 IP 字面量：直接校验
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) {
    return isBlockedIp(hostname) ? null : url;
  }
  // 域名：解析后逐 IP 校验
  const ips = await resolveHostIps(hostname);
  if (ips.length === 0) return null;
  if (ips.some(isBlockedIp)) return null;
  return url;
}

// ─── 受限抓取：手动跟随重定向（逐跳校验）、超时、限量读取 ────
async function fetchHtmlLimited(startUrl: URL): Promise<string> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const resp = await fetch(current, {
      headers: { 'User-Agent': MOBILE_UA },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      await resp.body?.cancel().catch(() => {});
      if (!location) throw new Error('redirect without location');
      const next = await assertPublicHttpUrl(new URL(location, current).toString());
      if (!next) throw new Error('redirect target blocked');
      current = next;
      continue;
    }
    if (!resp.ok) throw new Error(`upstream ${resp.status}`);
    // 限量读取响应体
    const reader = resp.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error('response too large');
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }
  throw new Error('too many redirects');
}

// ─── OG / JSON-LD 元数据解析 ─────────────────────────────────
function parseMeta(html: string) {
  const getMeta = (prop: string): string | undefined => {
    const m =
      html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
      ) ||
      html.match(
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'),
      );
    return m ? m[1] : undefined;
  };

  let title = getMeta('og:title') || getMeta('twitter:title');
  const description = getMeta('og:description') || getMeta('twitter:description');
  let author = getMeta('og:author') || getMeta('author') || getMeta('twitter:author');
  let coverUrl = getMeta('og:image') || getMeta('og:image:url') || getMeta('twitter:image');

  // <link rel="image_src"> 兜底封面
  if (!coverUrl) {
    const link =
      html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']*)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']image_src["']/i);
    if (link) coverUrl = link[1];
  }

  // JSON-LD 结构化数据补全作者 / 封面（抖音/小红书常含）
  const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ld) {
    try {
      const data = JSON.parse(ld[1].replace(/<!\[CDATA\[|\]\]>/g, ''));
      const items: any[] = Array.isArray(data) ? data : data['@graph'] || [data];
      for (const it of items) {
        if (!title && it.headline) title = it.headline;
        if (!author && it.author) {
          const a = it.author;
          author = typeof a === 'string' ? a : a.name || a['@id'];
        }
        if (!coverUrl && (it.thumbnailUrl || it.image)) {
          const img = it.thumbnailUrl || it.image;
          coverUrl = Array.isArray(img) ? img[0] : typeof img === 'string' ? img : img?.url;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!title && t) title = t[1];
  return { title, author, description, coverUrl };
}

// ─── 入口 ────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }
  if (req.method !== 'GET') {
    return json(req, 405, { error: 'method not allowed' });
  }
  if (!(await requireUser(req))) {
    return json(req, 401, { error: 'unauthorized' });
  }
  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) {
    return json(req, 400, { error: 'missing url' });
  }
  const target = await assertPublicHttpUrl(raw);
  if (!target) {
    return json(req, 400, { error: 'url not allowed' });
  }
  try {
    const html = await fetchHtmlLimited(target);
    return json(req, 200, parseMeta(html));
  } catch (e) {
    return json(req, 502, { error: String(e instanceof Error ? e.message : e) });
  }
});
