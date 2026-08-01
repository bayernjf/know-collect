// Supabase Edge Function (Deno)
// 服务端抓取视频页元数据，规避浏览器 CORS。部署：supabase functions deploy fetch-meta
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// 移动端 UA：让抖音/小红书等服务端返回带 OG 元数据的 SSR 页面（桌面端常为 SPA 空壳）
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'missing url' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': MOBILE_UA },
      redirect: 'follow',
    });
    const html = await resp.text();
    const meta = parseMeta(html);
    return new Response(JSON.stringify(meta), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
