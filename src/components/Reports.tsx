import { useState } from 'react';
import { useStore } from '../store';
import { useAIModals } from '../useAIModals';
import ReportModal from './ReportModal';

export default function Reports() {
  const { reports, deleteReport } = useStore();
  const { generateReport, generateWeekly, reportModals } = useAIModals();
  const [viewId, setViewId] = useState<string | null>(null);

  const report = reports.find((r) => r.id === viewId) ?? null;

  return (
    <div className="page">
      <header className="page-header">
        <h1>📝 AI 报告</h1>
        <p className="subtitle">智能汇总的视频收藏分析报告</p>
      </header>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => generateReport()}>
          📝 生成综合报告
        </button>
        <button className="btn btn-outline" onClick={generateWeekly}>
          📅 生成周报
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="empty-hint">
          还没有报告，先去「视频库」生成 AI 总结，再来生成报告吧！
        </p>
      ) : (
        <div className="report-list">
          {reports.map((r) => (
            <div key={r.id} className="report-item">
              <div className="report-item-header">
                <h3>{r.title}</h3>
                <span className="report-date">{r.date}</span>
              </div>
              <div className="report-item-meta">
                <span>📊 {r.videoCount} 个视频</span>
                <span>🗂️ {r.platforms.join('、')}</span>
              </div>
              {r.tags.length > 0 && (
                <div className="tag-list">
                  {r.tags.map((t) => (
                    <span key={t} className="tag">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <div className="report-item-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setViewId(r.id)}
                >
                  👁️ 查看详情
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm('确定删除这份报告吗？')) deleteReport(r.id);
                  }}
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {report && (
        <ReportModal report={report} onClose={() => setViewId(null)} />
      )}
      {reportModals}
    </div>
  );
}
