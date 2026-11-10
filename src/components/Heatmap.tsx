import { useMemo } from 'react';
import { formatLocalDate } from '../lib/date';
import type { Video } from '../types';

interface HeatmapProps {
  videos: Video[];
}

/**
 * GitHub 风格的学习热力图 — 展示过去 13 周（91 天）每天的收藏数量
 */
export default function Heatmap({ videos }: HeatmapProps) {
  const { weeks, maxCount, totalDays, activeDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = 91; // 13 weeks
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    // 对齐到周一
    const mondayOffset = (startDate.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - mondayOffset);

    // 统计每天的收藏数
    const countMap: Record<string, number> = {};
    videos.forEach((v) => {
      const d = v.dateAdded.slice(0, 10);
      countMap[d] = (countMap[d] || 0) + 1;
    });

    // 生成日期网格
    const cells: { date: string; count: number; future: boolean }[] = [];
    const cursor = new Date(startDate);
    while (cursor <= today) {
      // 用本地日期（不是 UTC），否则 UTC+8 下每个格子的 key 会早一天。
      const key = formatLocalDate(cursor);
      cells.push({ date: key, count: countMap[key] || 0, future: false });
      cursor.setDate(cursor.getDate() + 1);
    }
    // 补齐到周日
    while (cursor.getDay() !== 0) {
      const key = formatLocalDate(cursor);
      cells.push({ date: key, count: 0, future: true });
      cursor.setDate(cursor.getDate() + 1);
    }

    // 按周分组
    const weekArr: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weekArr.push(cells.slice(i, i + 7));
    }

    const allCounts = cells.filter((c) => !c.future).map((c) => c.count);
    const max = Math.max(...allCounts, 1);
    const active = allCounts.filter((c) => c > 0).length;

    return { weeks: weekArr, maxCount: max, totalDays: allCounts.length, activeDays: active };
  }, [videos]);

  const getColor = (count: number): string => {
    if (count === 0) return 'var(--bg2)';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return '#1a4a2e';
    if (ratio <= 0.5) return '#236b3e';
    if (ratio <= 0.75) return '#2d8f4e';
    return '#39c265';
  };

  // 月份标签
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    const seen = new Set<string>();
    weeks.forEach((week, wi) => {
      const firstDay = week[0]?.date;
      if (!firstDay) return;
      // 直接解析 YYYY-MM-DD 的本地年月，避免 new Date(str) 按 UTC 解析造成跨月偏移。
      const monthKey = firstDay.slice(0, 7);
      if (!seen.has(monthKey)) {
        seen.add(monthKey);
        labels.push({
          label: new Date(Number(firstDay.slice(0, 4)), Number(firstDay.slice(5, 7)) - 1, 1).toLocaleDateString('zh-CN', { month: 'short' }),
          col: wi,
        });
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-stats">
        <span>过去 {totalDays} 天共 <strong>{activeDays}</strong> 天有收藏记录</span>
        <span>最高单日 <strong>{maxCount}</strong> 个视频</span>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-months">
          {monthLabels.map((m, i) => (
            <span key={i} style={{ gridColumn: m.col + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="heatmap-grid">
          {/* 星期标签 */}
          <div className="heatmap-day-labels">
            {['一', '', '三', '', '五', '', '日'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          {/* 热力格子 */}
          <div className="heatmap-cells">
            {weeks.map((week, wi) => (
              <div key={wi} className="heatmap-week">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="heatmap-cell"
                    style={{ background: day.future ? 'transparent' : getColor(day.count) }}
                    title={`${day.date}：${day.count} 个视频`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span>少</span>
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
          <div
            key={i}
            className="heatmap-cell legend-cell"
            style={{ background: i === 0 ? 'var(--bg2)' : getColor(r * maxCount || 1) }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
