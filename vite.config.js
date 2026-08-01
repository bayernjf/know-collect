import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 开发期服务端代理：/api/meta?url=... 在服务端抓取目标页并解析 OG 元数据，
// 避免浏览器直连抖音/小红书时的 CORS 问题。生产环境请改用部署好的元数据代理。
// 使用 globalThis 上的运行时全局（Node 18+ 自带 URL/fetch），避免额外类型依赖。
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
                try {
                    const resp = await globalThis.fetch(url, {
                        headers: { 'User-Agent': MOBILE_UA },
                        redirect: 'follow',
                    });
                    const html = await resp.text();
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
