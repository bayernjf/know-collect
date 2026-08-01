import { useState, type ReactNode } from 'react';
import { useStore } from './store';
import { generateAISummary } from './mockAI';
import { generateSummaryWithAI, generateReportWithAI } from './lib/ai';
import type { Video, Report } from './types';
import AnalyzerModal from './components/AnalyzerModal';
import ReportModal from './components/ReportModal';

interface AnalyzerState {
  title: string;
  steps: string[];
  onDone: () => void;
}

/** 集中管理「AI 分析进度弹窗」与「报告详情弹窗」的共享 Hook */
export function useAIModals() {
  const store = useStore();
  const [analyzer, setAnalyzer] = useState<AnalyzerState | null>(null);
  const [viewReport, setViewReport] = useState<Report | null>(null);

  const summarizeOne = (video: Video) => {
    const aiConfig = store.getDefaultAIConfig();
    setAnalyzer({
      title: '🤖 AI 正在分析...',
      steps: [
        `正在分析：${video.title}`,
        '提取关键信息',
        '生成结构化总结',
        '提炼核心要点',
        '完成 ✅',
      ],
      onDone: async () => {
        try {
          if (aiConfig) {
            const r = await generateSummaryWithAI(video, aiConfig);
            store.saveSummary(video.id, r.content, r.keyPoints);
          } else {
            const r = generateAISummary(video);
            store.saveSummary(video.id, r.content, r.keyPoints);
          }
          store.showToast('AI 总结完成 ✅');
        } catch (err: any) {
          store.showToast(`AI 总结失败: ${err.message}`, true);
        }
        setAnalyzer(null);
      },
    });
  };

  const summarizeSelected = (ids: Set<string>) => {
    const toSum = store.videos.filter((v) => ids.has(v.id) && !v.summary);
    if (toSum.length === 0) {
      store.showToast('所选视频已全部总结', true);
      return;
    }
    const aiConfig = store.getDefaultAIConfig();
    setAnalyzer({
      title: '🤖 AI 总结选中视频',
      steps: toSum.map((v) => `正在总结：${v.title}`),
      onDone: async () => {
        try {
          for (const v of toSum) {
            if (aiConfig) {
              const r = await generateSummaryWithAI(v, aiConfig);
              store.saveSummary(v.id, r.content, r.keyPoints);
            } else {
              const r = generateAISummary(v);
              store.saveSummary(v.id, r.content, r.keyPoints);
            }
          }
          store.showToast('已对选中视频完成总结 ✅');
        } catch (err: any) {
          store.showToast(`批量总结出错: ${err.message}`, true);
        }
        setAnalyzer(null);
      },
    });
  };

  const summarizeAll = () => {
    const toSum = store.videos.filter((v) => !v.summary);
    if (toSum.length === 0) {
      store.showToast('所有视频已总结', true);
      return;
    }
    const aiConfig = store.getDefaultAIConfig();
    setAnalyzer({
      title: '🤖 批量 AI 总结',
      steps: toSum.map((v) => `正在总结：${v.title}`),
      onDone: async () => {
        try {
          for (const v of toSum) {
            if (aiConfig) {
              const r = await generateSummaryWithAI(v, aiConfig);
              store.saveSummary(v.id, r.content, r.keyPoints);
            } else {
              const r = generateAISummary(v);
              store.saveSummary(v.id, r.content, r.keyPoints);
            }
          }
          store.showToast('批量总结完成 ✅');
        } catch (err: any) {
          store.showToast(`批量总结出错: ${err.message}`, true);
        }
        setAnalyzer(null);
      },
    });
  };

  const generateReport = (source?: Video[]) => {
    const aiConfig = store.getDefaultAIConfig();
    setAnalyzer({
      title: '📝 正在生成综合报告...',
      steps: ['分析视频内容', '提取关键主题', '生成结构化报告', '整合趋势洞察'],
      onDone: async () => {
        try {
          const sourceVideos = source ?? store.videos.filter((v) => v.summary);
          if (sourceVideos.length === 0) {
            store.showToast('请先生成视频的 AI 总结', true);
            setAnalyzer(null);
            return;
          }

          let content: string;
          if (aiConfig) {
            content = await generateReportWithAI(sourceVideos, aiConfig);
          } else {
            const r = store.createReport(source);
            if (r) {
              setViewReport(r);
              store.showToast('报告已生成 ✅');
            }
            setAnalyzer(null);
            return;
          }

          const platforms = [...new Set(sourceVideos.map((v) => v.platform))];
          const pnames = platforms.map((p) =>
            p === 'douyin' ? '抖音' : p === 'bilibili' ? 'B站' : '小红书',
          );
          const allTags = new Set<string>();
          sourceVideos.forEach((v) => v.tags.forEach((t) => allTags.add(t)));

          const report: Report = {
            id: 'r_' + Date.now() + Math.random().toString(36).slice(2, 6),
            title: `综合视频分析报告 · ${new Date().toLocaleDateString('zh-CN')}`,
            date: new Date().toLocaleString('zh-CN'),
            videoCount: sourceVideos.length,
            platforms: pnames,
            tags: [...allTags].slice(0, 15),
            content,
            videoIds: sourceVideos.map((v) => v.id),
          };
          store.addReport(report);
          setViewReport(report);
          store.showToast('报告已生成 ✅');
        } catch (err: any) {
          store.showToast(`报告生成失败: ${err.message}`, true);
        }
        setAnalyzer(null);
      },
    });
  };

  const generateWeekly = () => {
    setAnalyzer({
      title: '📅 正在生成周报...',
      steps: ['统计本周收藏', '聚簇话题标签', '生成周度报告'],
      onDone: () => {
        const r = store.createWeeklyReport();
        if (r) {
          setViewReport(r);
          store.showToast('周报已生成 ✅');
        } else {
          store.showToast('近一周没有已总结的视频', true);
        }
        setAnalyzer(null);
      },
    });
  };

  const reportModals: ReactNode = (
    <>
      {analyzer && (
        <AnalyzerModal
          title={analyzer.title}
          steps={analyzer.steps}
          onComplete={analyzer.onDone}
        />
      )}
      {viewReport && (
        <ReportModal report={viewReport} onClose={() => setViewReport(null)} />
      )}
    </>
  );

  return {
    summarizeOne,
    summarizeSelected,
    summarizeAll,
    generateReport,
    generateWeekly,
    reportModals,
  };
}
