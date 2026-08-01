import { useState } from 'react';
import type { Video, VideoStatus } from '../types';
import { platformName, platformIcon } from '../utils';

const STATUS_MAP: Record<VideoStatus, { label: string; cls: string }> = {
  unread: { label: '待看', cls: 'status-unread' },
  reading: { label: '在看', cls: 'status-reading' },
  done: { label: '已看', cls: 'status-done' },
  starred: { label: '精华', cls: 'status-starred' },
};

interface VideoCardProps {
  video: Video;
  onOpen: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function VideoCard({
  video,
  onOpen,
  selectable = false,
  selected = false,
  onToggleSelect,
}: VideoCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  return (
    <div
      className={
        'video-card' +
        (video.summary ? ' has-summary' : '') +
        (selected ? ' selected' : '')
      }
      onClick={() => onOpen(video.id)}
    >
      {selectable && (
        <input
          type="checkbox"
          className="video-select"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect?.(video.id)}
        />
      )}
      <div className="video-thumb">
        {video.coverUrl && !coverFailed ? (
          <img
            className="cover-img"
            src={video.coverUrl}
            alt={video.title}
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <span className="placeholder">{platformIcon(video.platform)}</span>
        )}
        <span className={'platform-badge ' + video.platform}>
          {platformName(video.platform)}
        </span>
        {video.duration && <span className="duration">{video.duration}</span>}
      </div>
      <div className="video-info">
        <h3>{video.title}</h3>
        <div className="video-meta">
          <span>{video.author || '未知作者'}</span>
          <span>·</span>
          <span>{video.dateAdded}</span>
        </div>
        {video.tags.length > 0 && (
          <div className="tag-list">
            {video.tags.slice(0, 3).map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="summary-status">
          {video.summary ? (
            <span className="done">✅ 已总结</span>
          ) : (
            <span className="pending">⏳ 待总结</span>
          )}
          <span className={'video-status ' + STATUS_MAP[video.status || 'unread'].cls}>
            {STATUS_MAP[video.status || 'unread'].label}
          </span>
        </div>
      </div>
    </div>
  );
}
