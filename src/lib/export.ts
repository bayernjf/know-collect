import type { Report } from '../types';

/**
 * 将 Report 转换为格式化的 Markdown 文本
 */
export function reportToMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`> 生成日期：${report.date}  `);
  lines.push(`> 视频数量：${report.videoCount}  `);
  lines.push(`> 平台来源：${report.platforms.join('、')}`);
  lines.push('');

  if (report.tags.length > 0) {
    lines.push(`**标签：** ${report.tags.map((t) => `#${t}`).join(' ')}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(report.content);
  lines.push('');
  lines.push('---');
  lines.push(`*由 VideoVault 生成 · ${report.date}*`);

  return lines.join('\n');
}

/**
 * 将 Report 转换为可打印的 HTML（用于 PDF 导出）
 */
export function reportToPrintHTML(report: Report): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHTML(report.title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    max-width: 800px; margin: 0 auto; padding: 40px 24px;
    color: #1a1a2e; line-height: 1.8; background: #fff;
  }
  h1 { font-size: 1.8rem; margin-bottom: 16px; color: #2d3436; }
  .meta { color: #636e72; font-size: 0.9rem; margin-bottom: 8px; }
  .tags { margin: 12px 0 24px; }
  .tags span {
    display: inline-block; background: #f0f0f5; color: #6c5ce7;
    padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; margin-right: 6px;
  }
  hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
  .content { white-space: pre-wrap; font-size: 0.95rem; line-height: 1.9; }
  .footer { margin-top: 32px; font-size: 0.8rem; color: #b2bec3; text-align: center; }
  @media print {
    body { padding: 20px; }
  }
</style>
</head>
<body>
  <h1>${escapeHTML(report.title)}</h1>
  <div class="meta">📊 ${report.videoCount} 个视频 · 🗂️ ${report.platforms.join('、')} · 🕒 ${report.date}</div>
  ${report.tags.length > 0 ? `<div class="tags">${report.tags.map((t) => `<span>#${escapeHTML(t)}</span>`).join('')}</div>` : ''}
  <hr />
  <div class="content">${escapeHTML(report.content)}</div>
  <hr />
  <div class="footer">由 VideoVault 生成 · ${report.date}</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

/**
 * 下载文本为文件
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
