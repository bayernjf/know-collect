import type { Video } from './types';
import { platformName } from './utils';

export interface SummaryResult {
  content: string;
  keyPoints: string[];
}

/** 模拟 AI 总结：基于标题/描述/文稿中的关键词做模板拼装（非真实模型调用） */
export function generateAISummary(video: Video): SummaryResult {
  const platform = platformName(video.platform);
  const content = video.transcript || video.description || video.title || '';

  // Generate topic-based summary
  const topicKeywords = [
    '技术', '教程', 'AI', '编程', '设计', '美食', '旅行', '音乐', '电影', '科技',
    '生活', '学习', '职场', '创业', '健身', '美妆', '穿搭', '家居', '摄影', '游戏',
  ];
  const matchedTopics = topicKeywords.filter((t) => content.includes(t));
  const topics = matchedTopics.length > 0 ? matchedTopics.slice(0, 4) : ['综合', '知识分享'];

  const summaryTemplates = [
    `【内容概要】\n该视频来自${platform}，作者为${video.author || '未知创作者'}。视频主要围绕"${topics.join(
      '、',
    )}"等主题展开。\n\n【核心观点】\n1. ${topics[0] || '内容'}领域的深度解读与实践分享\n2. 通过案例展示关键方法论与应用技巧\n3. 提供可操作的建议与思考框架\n\n【受众画像】\n适合对${
      topics[0] || '该领域'
    }感兴趣的进阶学习者与从业者。\n\n【推荐理由】\n内容结构清晰，论据充分，可作为${
      topics[0] || '相关领域'
    }的学习参考资料。`,
    `【视频概述】\n这是一条来自${platform}的${topics.join('/')}类视频内容。创作者${
      video.author || '未知'
    }通过生动的表达方式，向观众传递了关于${topics[0] || '特定主题'}的见解。\n\n【关键信息】\n• 主题聚焦：${topics
      .slice(0, 2)
      .join('与')}\n• 内容风格：${Math.random() > 0.5 ? '教学讲解型' : '叙述分享型'}\n• 信息密度：${
      content.length > 100 ? '高' : '中等'
    }\n\n【学习要点】\n1. 理解${topics[0] || '核心'}概念的基础框架\n2. 掌握实践中的关键步骤与注意事项\n3. 借鉴创作者的经验总结与方法论\n\n【适用场景】\n可用于${
      Math.random() > 0.5 ? '个人知识体系搭建' : '团队学习讨论'
    }的素材参考。`,
    `【AI 深度分析】\n平台：${platform} | 创作者：${video.author || '未知'}\n内容领域：${topics.join(
      ' · ',
    )}\n\n【三段式总结】\n\n🔍 是什么：\n该视频探讨了${
      topics[0] || '特定领域'
    }中的核心问题，创作者结合自身经验展开论述。\n\n💡 为什么重要：\n${
      topics[0] || '该主题'
    }在当今${Math.random() > 0.5 ? '数字化时代' : '内容生态'}中具有重要价值，理解其本质有助于${
      Math.random() > 0.5 ? '提升认知效率' : '优化决策质量'
    }。\n\n🛠️ 如何应用：\n- 第一步：建立对${topics[0] || '基础概念'}的系统认知\n- 第二步：在实践中验证关键假设\n- 第三步：持续迭代优化方法论\n\n【推荐指数】${'⭐'.repeat(
      Math.floor(Math.random() * 2) + 4,
    )} (${Math.floor(Math.random() * 3) + 7}/10)`,
  ];

  const summary = summaryTemplates[Math.floor(Math.random() * summaryTemplates.length)];
  const keyPoints = ['核心方法论', '实践案例分析', '可操作建议', '行业趋势洞察'].slice(
    0,
    3 + Math.floor(Math.random() * 2),
  );

  return { content: summary, keyPoints };
}

export function generateComprehensiveReport(
  videos: Video[],
  pnames: string[],
  allTags: string[],
): string {
  const topTags = allTags.slice(0, 6).join('、');
  const pstr = pnames.join('、');
  return `═══════════════════════════════════
  📊 多平台视频综合分析报告
═══════════════════════════════════

📌 报告概述
─────────────────────────
本报告基于 ${videos.length} 个已收藏视频的 AI 总结生成，
覆盖 ${pstr} ${pnames.length} 个平台的内容分析。

📈 数据统计
─────────────────────────
• 分析视频总数：${videos.length}
• 覆盖平台数：${pnames.length}（${pstr}）
• 提取标签数：${allTags.length} 个
• 核心话题领域：${topTags || '多元化内容'}

🔍 趋势洞察
─────────────────────────
1. 内容生态多样性
   跨 ${pstr} 的内容消费呈现多元化趋势，
   不同平台在内容形态和表达方式上各具特色。

2. 知识获取路径
   用户通过多平台交叉验证信息，
   形成了更立体的知识获取模式。

3. 兴趣图谱分析
   基于标签聚类，当前关注领域集中在：
   ${topTags || '综合知识、技能学习、行业资讯'}

💡 关键发现
─────────────────────────
• 短视频平台（抖音）更侧重即时信息获取
• 中长视频平台（B站）提供更深入的教程内容
• 图文社区（小红书）补充了生活方式视角

🎯 行动建议
─────────────────────────
1. 对${topTags.split('、')[0] || '核心'}领域进行深度学习
2. 跨平台对比同主题内容的差异
3. 定期整理并构建个人知识体系

📅 报告生成时间：${new Date().toLocaleString('zh-CN')}
─────────────────────────`;
}

export function generateWeeklyReportContent(videos: Video[]): string {
  const tags = [...new Set(videos.flatMap((v) => v.tags || []))];
  return `═══════════════════════════════════
  📅 本周视频学习周报
═══════════════════════════════════

📊 本周数据
─────────────────────────
• 本周收藏：${videos.length} 个视频
• 涉及标签：${tags.length} 个
• 核心关注：${tags.slice(0, 5).join('、') || '多元化内容'}

📈 学习进度
─────────────────────────
本周你在多平台共收藏了 ${videos.length} 个视频，
内容涵盖 ${tags.slice(0, 4).join('、')} 等领域。
AI 已完成全部内容的智能分析与要点提炼。

🎯 下周建议
─────────────────────────
1. 回顾本周重点视频的核心要点
2. 基于 AI 总结构建知识卡片
3. 关注 ${tags[0] || '核心'} 领域的深度内容

📅 报告时间：${new Date().toLocaleString('zh-CN')}
─────────────────────────`;
}
