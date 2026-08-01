import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useAIModals } from '../useAIModals';
import VideoCard from './VideoCard';
import AddVideoModal from './AddVideoModal';
import VideoDetailModal from './VideoDetailModal';
import Heatmap from './Heatmap';
import type { Page, Video } from '../types';

interface DashboardProps {
  onNavigate: (p: Page) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { videos, reminders, completeReminder, snoozeReminder, deleteReminder, requestNotificationPermission } =
    useStore();
  const { summarizeAll, generateReport, summarizeOne, reportModals } = useAIModals();
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = videos.length;
    const douyin = videos.filter((v) => v.platform === 'douyin').length;
    const bilibili = videos.filter((v) => v.platform === 'bilibili').length;
    const xiaohongshu = videos.filter((v) => v.platform === 'xiaohongshu').length;
    const summarized = videos.filter((v) => v.summary).length;
    const tagCount: Record<string, number> = {};
    videos.forEach((v) => v.tags.forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    const max = topTags.length ? topTags[0][1] : 1;
    return { total, douyin, bilibili, xiaohongshu, summarized, topTags, max };
  }, [videos]);

  const recent = useMemo(() => videos.slice(-6).reverse(), [videos]);

  const dueReminders = reminders.filter(
    (r) => r.status === 'active' && new Date(r.dueDate).getTime() <= Date.now(),
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1>📊 数据看板</h1>
        <p className="subtitle">你的跨平台视频收藏全景视图</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总收藏数</div>
        </div>
        <div className="stat-card douyin">
          <div className="stat-value">{stats.douyin}</div>
          <div className="stat-label">抖音</div>
        </div>
        <div className="stat-card bilibili">
          <div className="stat-value">{stats.bilibili}</div>
          <div className="stat-label">B站</div>
        </div>
        <div className="stat-card xiaohongshu">
          <div className="stat-value">{stats.xiaohongshu}</div>
          <div className="stat-label">小红书</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.summarized}</div>
          <div className="stat-label">已 AI 总结</div>
        </div>
      </div>

      <section className="section">
        <h2>🔥 学习热力图</h2>
        <Heatmap videos={videos} />
      </section>

      <section className="section">
        <h2>🕒 最近收藏</h2>
        {recent.length === 0 ? (
          <p className="empty-hint">还没有收藏视频，去添加一些吧！</p>
        ) : (
          <div className="video-grid">
            {recent.map((v: Video) => (
              <VideoCard key={v.id} video={v} onOpen={setDetailId} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>
          ⏰ 复习提醒
          {dueReminders.length > 0 && <span className="badge-count">{dueReminders.length}</span>}
        </h2>
        {dueReminders.length === 0 ? (
          <p className="empty-hint">暂无到期提醒，给视频设置「学习提醒」开启间隔重复吧</p>
        ) : (
          <div className="reminder-list">
            {dueReminders.map((r) => (
              <div key={r.id} className="reminder-item">
                <div className="reminder-main">
                  <button className="reminder-title" onClick={() => setDetailId(r.videoId)}>
                    {r.videoTitle || '未命名视频'}
                  </button>
                  <span className="reminder-sub">
                    第 {r.repetition + 1} 次复习 · 间隔 {r.intervalDays} 天
                  </span>
                </div>
                <div className="reminder-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => completeReminder(r.id)}>
                    ✅ 已复习
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => snoozeReminder(r.id, 1)}>
                    稍后
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteReminder(r.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>🔥 热门话题</h2>
        {stats.topTags.length === 0 ? (
          <p className="empty-hint">暂无标签数据</p>
        ) : (
          <div className="topic-cloud">
            {stats.topTags.map(([tag, count]) => (
              <span
                key={tag}
                className="topic-tag"
                style={{ fontSize: 0.8 + (count / stats.max) * 0.9 + 'rem' }}
              >
                #{tag}
                <sup>{count}</sup>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>⚡ 快捷操作</h2>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            ➕ 添加收藏视频
          </button>
          <button className="btn btn-outline" onClick={summarizeAll}>
            🤖 批量 AI 总结
          </button>
          <button className="btn btn-outline" onClick={() => generateReport()}>
            📝 生成综合报告
          </button>
          <button
            className="btn btn-outline"
            onClick={() => onNavigate('reports')}
          >
            📋 查看历史报告
          </button>
          <button className="btn btn-outline" onClick={requestNotificationPermission}>
            🔔 开启复习提醒通知
          </button>
        </div>
      </section>

      {showAdd && <AddVideoModal onClose={() => setShowAdd(false)} />}
      {detailId && (
        <VideoDetailModal
          videoId={detailId}
          onClose={() => setDetailId(null)}
          onSummarize={summarizeOne}
        />
      )}
      {reportModals}
    </div>
  );
}
