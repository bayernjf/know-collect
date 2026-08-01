import { useState } from 'react';
import Modal from './Modal';
import { useStore } from '../store';
import type { Reminder } from '../types';

interface ReminderModalProps {
  videoId: string;
  videoTitle: string;
  existing?: Reminder;
  onClose: () => void;
}

const DELAYS = [
  { days: 1, label: '明天' },
  { days: 3, label: '3 天后' },
  { days: 7, label: '1 周后' },
  { days: 14, label: '2 周后' },
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReminderModal({ videoId, videoTitle, existing, onClose }: ReminderModalProps) {
  const { addReminder, deleteReminder, showToast } = useStore();
  const [days, setDays] = useState(1);

  if (existing) {
    return (
      <Modal onClose={onClose}>
        <h2>⏰ 复习提醒</h2>
        <p className="subtitle">{videoTitle}</p>
        <div className="reminder-info">
          <p>下次复习：<strong>{fmt(existing.dueDate)}</strong></p>
          <p>复习间隔：{existing.intervalDays} 天 · 已完成 {existing.repetition} 次</p>
        </div>
        <p className="hint-text">复习完成后提醒会自动按间隔重复顺延，直到你熟练掌握。</p>
        <div className="form-actions">
          <button
            className="btn btn-danger"
            onClick={() => {
              deleteReminder(existing.id);
              onClose();
            }}
          >
            🗑️ 取消提醒
          </button>
          <button className="btn btn-outline" onClick={onClose}>
            关闭
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2>⏰ 设置复习提醒</h2>
      <p className="subtitle">{videoTitle}</p>
      <p className="hint-text">系统将按「间隔重复」算法，在每次复习后自动延长提醒间隔。</p>
      <div className="delay-grid">
        {DELAYS.map((d) => (
          <button
            key={d.days}
            className={'delay-option' + (days === d.days ? ' active' : '')}
            onClick={() => setDays(d.days)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="form-actions">
        <button
          className="btn btn-outline"
          onClick={onClose}
        >
          取消
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            addReminder(videoId, days);
            showToast('已设置复习提醒 ⏰');
            onClose();
          }}
        >
          💾 创建提醒
        </button>
      </div>
    </Modal>
  );
}
