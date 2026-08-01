import type { AIConfig, Video } from '../types';

export interface AISummaryResult {
  content: string;
  keyPoints: string[];
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/**
 * 测试 AI 模型连接
 * 发送一个简单请求验证 API 可达性和密钥有效性
 */
export async function testAIConnection(config: {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  provider: string;
}): Promise<TestConnectionResult> {
  const startTime = Date.now();

  try {
    const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      let msg = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errBody);
        msg = parsed.error?.message || parsed.message || msg;
      } catch {
        // ignore parse error
      }
      return { success: false, message: `连接失败: ${msg}`, latencyMs };
    }

    const data = await response.json();
    const model = data.model || config.modelName;
    return {
      success: true,
      message: `连接成功 ✅ 模型: ${model}，响应延迟: ${latencyMs}ms`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { success: false, message: '连接超时（15s），请检查 API 地址是否正确', latencyMs };
    }
    return {
      success: false,
      message: `网络错误: ${err.message || '无法连接到服务器'}`,
      latencyMs,
    };
  }
}

/**
 * 调用 AI 模型生成视频总结
 */
export async function generateSummaryWithAI(
  video: Video,
  config: AIConfig,
): Promise<AISummaryResult> {
  const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const systemPrompt = `你是一个专业的视频内容分析师。请根据提供的视频信息，生成结构化的内容总结。
要求：
1. 用中文回复
2. 包含【内容概要】【核心观点】【关键要点】三个部分
3. 总结要精炼有洞察力，不要泛泛而谈
4. 最后单独列出 3-5 个核心要点（用 | 分隔）`;

  const userPrompt = `请分析以下视频内容：
标题：${video.title}
平台：${video.platform}
作者：${video.author || '未知'}
描述：${video.description || '无'}
标签：${video.tags.join('、') || '无'}
${video.transcript ? `文稿/字幕：\n${video.transcript}` : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    let msg = `AI 请求失败 (HTTP ${response.status})`;
    try {
      const parsed = JSON.parse(errBody);
      msg = parsed.error?.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content || '';

  // 解析要点（用 | 分隔的最后一行）
  const lines = text.split('\n');
  let keyPoints: string[] = [];
  let content = text;

  const lastLine = lines[lines.length - 1];
  if (lastLine.includes('|')) {
    keyPoints = lastLine.split('|').map((s) => s.trim()).filter(Boolean);
    content = lines.slice(0, -1).join('\n').trim();
  } else {
    // 尝试提取带序号的要点
    const pointLines = lines.filter((l) => /^\d+[.、)]/.test(l.trim()));
    if (pointLines.length >= 3) {
      keyPoints = pointLines.slice(0, 5).map((l) => l.replace(/^\d+[.、)]\s*/, '').trim());
    }
  }

  if (keyPoints.length === 0) {
    keyPoints = ['内容分析完成'];
  }

  return { content, keyPoints };
}

/**
 * 调用 AI 生成综合报告
 */
export async function generateReportWithAI(
  videos: Video[],
  config: AIConfig,
): Promise<string> {
  const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const videoSummaries = videos
    .map(
      (v, i) =>
        `${i + 1}. [${v.platform}] ${v.title} (作者: ${v.author || '未知'})\n   总结: ${v.summary || '无'}`,
    )
    .join('\n');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        {
          role: 'system',
          content:
            '你是数据分析专家。请根据多个视频的 AI 总结，生成一份综合分析报告。包含：数据统计、趋势洞察、关键发现、行动建议。用中文回复。',
        },
        {
          role: 'user',
          content: `以下是 ${videos.length} 个视频的总结信息，请生成综合分析报告：\n\n${videoSummaries}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    throw new Error(`AI 报告生成失败 (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '报告生成失败';
}
