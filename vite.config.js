import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 开发期服务端代理：/api/meta?url=... 在服务端抓取目标页并解析 OG 元数据，
// 避免浏览器直连抖音/小红书时的 CORS 问题。生产环境请改用部署好的元数据代理。
// 与 supabase/functions/fetch-meta 保持同构防护：协议白名单、私网/环回/链路本地
// 地址拦截（防 SSRF）、最多 3 次重定向、10s 超时、1MB 响应上限。
// 使用 globalThis 上的运行时全局（Node 18+ 自带 URL/fetch），避免额外类型依赖。
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 1048576;
function isBlockedIpv4(ip) {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
        return true;
    const [a, b] = parts;
    return (a === 0 || a === 10 || a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51) ||
        (a === 203 && b === 0) ||
        a >= 224);
}
/** 展开 IPv6 为 8 个 16 位组；解析失败返回 null。 */
function parseIpv6Groups(ip) {
    const normalized = ip.toLowerCase();
    if (normalized.includes('.')) {
        // 混合写法（::ffff:1.2.3.4）：把尾部 IPv4 换成两组 hex 再解析
        const lastColon = normalized.lastIndexOf(':');
        const v4 = normalized.slice(lastColon + 1);
        const parts = v4.split('.').map((p) => Number(p));
        if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
            return null;
        const hi = ((parts[0] << 8) | parts[1]).toString(16);
        const lo = ((parts[2] << 8) | parts[3]).toString(16);
        return parseIpv6Groups(`${normalized.slice(0, lastColon)}:${hi}:${lo}`);
    }
    const halves = normalized.split('::');
    if (halves.length > 2)
        return null;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    if (left.length + right.length > 8)
        return null;
    if (halves.length === 1 && left.length !== 8)
        return null;
    const fill = 8 - left.length - right.length;
    const groups = [...left, ...Array(fill).fill('0'), ...right];
    const parsed = groups.map((g) => parseInt(g, 16));
    if (parsed.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff))
        return null;
    return parsed;
}
function isBlockedIpv6(ip) {
    const groups = parseIpv6Groups(ip);
    if (!groups)
        return true; // 解析不了的一律拒绝
    // IPv4-mapped（::ffff:0:0/96）与 NAT64（64:ff9b::/96）：按映射出的 IPv4 校验
    const isMapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
    const isNat64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
    if (isMapped || isNat64) {
        const v4 = `${(groups[6] >> 8) & 0xff}.${groups[6] & 0xff}.${(groups[7] >> 8) & 0xff}.${groups[7] & 0xff}`;
        return isBlockedIpv4(v4);
    }
    if (groups.every((g) => g === 0))
        return true; // :: 未指定
    if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1)
        return true; // ::1 环回
    if ((groups[0] & 0xffc0) === 0xfe80)
        return true; // fe80::/10 链路本地
    if ((groups[0] & 0xfe00) === 0xfc00)
        return true; // fc00::/7 ULA
    if ((groups[0] & 0xff00) === 0xff00)
        return true; // ff00::/8 组播
    if (groups[0] === 0x2001 && groups[1] === 0x0db8)
        return true; // 2001:db8::/32 文档段
    return false;
}
function isBlockedIp(ip) {
    return ip.includes(':') ? isBlockedIpv6(ip) : isBlockedIpv4(ip);
}
/** 校验目标 URL：仅 http/https，IP 字面量与 DNS 解析结果均不得命中阻断网段。 */
async function assertPublicHttpUrl(raw) {
    const URLCtor = globalThis.URL;
    let url;
    try {
        url = new URLCtor(raw);
    }
    catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return null;
    const hostname = String(url.hostname).replace(/^\[|\]$/g, '');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) {
        return isBlockedIp(hostname) ? null : url;
    }
    // 变量形式的 specifier 绕过 TS 模块解析（运行时由 Node 解析内置模块）
    const dnsSpecifier = 'node:' + 'dns';
    const { promises: dns } = (await import(dnsSpecifier));
    let addresses = [];
    try {
        addresses = await dns.lookup(hostname, { all: true });
    }
    catch {
        return null;
    }
    if (addresses.length === 0)
        return null;
    if (addresses.some((entry) => isBlockedIp(entry.address)))
        return null;
    return url;
}
async function fetchHtmlLimited(startUrl) {
    const fetchFn = globalThis.fetch;
    const URLCtor = globalThis.URL;
    let current = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const resp = await fetchFn(current, {
            headers: { 'User-Agent': MOBILE_UA },
            redirect: 'manual',
            signal: globalThis.AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (resp.status >= 300 && resp.status < 400) {
            const location = resp.headers.get('location');
            await resp.body?.cancel().catch(() => { });
            if (!location)
                throw new Error('redirect without location');
            const next = await assertPublicHttpUrl(new URLCtor(location, current).toString());
            if (!next)
                throw new Error('redirect target blocked');
            current = next;
            continue;
        }
        if (!resp.ok)
            throw new Error(`upstream ${resp.status}`);
        const reader = resp.body?.getReader();
        if (!reader)
            return '';
        const chunks = [];
        let received = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            received += value.byteLength;
            if (received > MAX_BODY_BYTES) {
                await reader.cancel().catch(() => { });
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
        return new globalThis.TextDecoder().decode(merged);
    }
    throw new Error('too many redirects');
}
function metaProxyPlugin() {
    return {
        name: 'videovault-meta-proxy',
        configureServer(server) {
            server.middlewares.use('/api/meta', async (req, res) => {
                const url = new globalThis.URL(req.url ?? '', 'http://localhost').searchParams.get('url');
                if (!url) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'missing url' }));
                    return;
                }
                const target = await assertPublicHttpUrl(url);
                if (!target) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'url not allowed' }));
                    return;
                }
                try {
                    const html = await fetchHtmlLimited(target);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(parseMeta(html)));
                }
                catch (e) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: String(e) }));
                }
            });
        },
    };
}
// 移动端 UA：让抖音/小红书等服务端返回带 OG 元数据的 SSR 页面（桌面端常为 SPA 空壳）
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
function parseMeta(html) {
    const getMeta = (prop) => {
        const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i')) ||
            html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
        return m ? m[1] : undefined;
    };
    let title = getMeta('og:title') || getMeta('twitter:title');
    const description = getMeta('og:description') || getMeta('twitter:description');
    let author = getMeta('og:author') || getMeta('author') || getMeta('twitter:author');
    let coverUrl = getMeta('og:image') || getMeta('og:image:url') || getMeta('twitter:image');
    // <link rel="image_src"> 兜底封面
    if (!coverUrl) {
        const link = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']*)["']/i) ||
            html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']image_src["']/i);
        if (link)
            coverUrl = link[1];
    }
    // JSON-LD 结构化数据补全作者 / 封面（抖音/小红书常含）
    const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (ld) {
        try {
            const data = JSON.parse(ld[1].replace(/<!\[CDATA\[|\]\]>/g, ''));
            const items = Array.isArray(data) ? data : data['@graph'] || [data];
            for (const it of items) {
                if (!title && it.headline)
                    title = it.headline;
                if (!author && it.author) {
                    const a = it.author;
                    author = typeof a === 'string' ? a : a.name || a['@id'];
                }
                if (!coverUrl && (it.thumbnailUrl || it.image)) {
                    const img = it.thumbnailUrl || it.image;
                    coverUrl = Array.isArray(img) ? img[0] : typeof img === 'string' ? img : img?.url;
                }
            }
        }
        catch {
            /* ignore */
        }
    }
    const t = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!title && t)
        title = t[1];
    return { title, author, description, coverUrl };
}
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), metaProxyPlugin()],
});
