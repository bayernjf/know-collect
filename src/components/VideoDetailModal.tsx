import { useState } from 'react';
import Modal from './Modal';
import AddVideoModal from './AddVideoModal';
import ReminderModal from './ReminderModal';
import { useStore } from '../store';
import { platformName, platformIcon } from '../utils';
import type { Video, VideoStatus } from '../types';

interface VideoDetailModalProps {
  videoId: string;
  onClose: () => void;
  onSummarize: (video: Video) => void;
}

const STATUS_OPTIONS: { value: VideoStatus; label: string }[] = [
  { value: 'unread', label: '📥 待看' },
  { value: 'reading', label: '📖 在看' },
  { value: 'done', label: '✅ 已看' },
  { value: 'starred', label: '⭐ 精华' },
];

export default function VideoDetailModal({
  videoId,
  onClose,
  onSummarize,
}: VideoDetailModalProps) {
  const { videos, folders, notes, reminders, deleteVideo, setVideoStatus, setVideoFolder, addNote, deleteNote, showToast } = useStore();
  const [showEdit, setShowEdit] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const existingReminder = reminders.find((r) => r.videoId === videoId);

  const video = videos.find((v) => v.id === videoId);
  if (!video) return null;

  const videoNotes = notes.filter((n) => n.videoId === videoId);

  const handleDelete = () => {
    if (confirm('确定删除这个视频吗？')) {
      deleteVideo(video.id);
      onClose();
    }
  };

  const copySummary = () => {
    if (video.summary) {
      navigator.clipboard.writeText(video.summary);
      showToast('已复制总结内容');
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(videoId, noteText.trim());
    setNoteText('');
  };

  return (
    <Modal onClose={onClose}>
      {video.coverUrl && (
        <img
          className="detail-cover"
          src={video.coverUrl}
          alt={video.title}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      <h2>
        {platformIcon(video.platform)} {video.title}
      </h2>
      <div className="detail-meta">
        <span className={'platform-badge ' + video.platform}>
          {platformName(video.platform)}
        </span>
        <span>{video.author || '未知作者'}</span>
        <span>·</span>
        <span>{video.dateAdded}</span>
      </div>

      {/* 状态 & 文件夹 */}
      <div className="detail-controls">
        <div className="status-select">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              className={'status-btn' + ((video.status || 'unread') === s.value ? ' active' : '')}
              onClick={() => setVideoStatus(video.id, s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {folders.length > 0 && (
          <select
            className="folder-select"
            value={video.folderId || ''}
            onChange={(e) => setVideoFolder(video.id, e.target.value || null)}
          >
            <option value="">无文件夹</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon} {f.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-outline btn-sm" onClick={() => setShowReminder(true)}>
          {existingReminder
            ? `⏰ ${new Date(existingReminder.dueDate).toLocaleDateString('zh-CN')} 复习`
            : '⏰ 设置提醒'}
        </button>
      </div>

      {video.url && (
        <p className="detail-url">
          🔗 <a href={video.url} target="_blank" rel="noopener noreferrer">查看原视频</a>
        </p>
      )}
      {video.tags.length > 0 && (
        <div className="tag-list">
          {video.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="summary-section">
        <div className="summary-header">
          <h3>🤖 AI 智能总结</h3>
          {video.summary && (
            <button className="btn btn-outline btn-sm" onClick={copySummary}>
              📋 复制
            </button>
          )}
        </div>
        {video.summary ? (
          <>
            <div className="summary-content">
              <pre>{video.summary}</pre>
            </div>
            {video.keyPoints && video.keyPoints.length > 0 && (
              <div className="key-points">
                {video.keyPoints.map((kp, i) => (
                  <span key={i} className="point">
                    {kp}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="summary-empty">
            <p>尚未生成 AI 总结</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onSummarize(video)}
            >
              🤖 生成 AI 总结
            </button>
          </div>
        )}
      </div>

      {/* 笔记区域 */}
      <div className="notes-section">
        <div className="notes-header" onClick={() => setShowNotes(!showNotes)}>
          <h3>📝 笔记 ({videoNotes.length})</h3>
          <span className="toggle-icon">{showNotes ? '▼' : '▶'}</span>
        </div>
        {showNotes && (
          <div className="notes-body">
            <div className="note-input-row">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="写下你的想法..."
                rows={2}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddNote}>
                添加
              </button>
            </div>
            {videoNotes.map((note) => (
              <div key={note.id} className="note-item">
                <p>{note.content}</p>
                <div className="note-meta">
                  <span>{new Date(note.createdAt).toLocaleString('zh-CN')}</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteNote(note.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {video.description && (
        <div className="detail-block">
          <h4>📝 描述</h4>
          <p>{video.description}</p>
        </div>
      )}
      {video.transcript && (
        <div className="detail-block">
          <h4>📜 文稿</h4>
          <p>{video.transcript}</p>
        </div>
      )}

      <div className="form-actions">
        <button
          className="btn btn-outline"
          onClick={() => setShowEdit(true)}
        >
          ✏️ 编辑
        </button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          🗑️ 删除
        </button>
        <button className="btn btn-outline" onClick={onClose}>
          关闭
        </button>
      </div>

      {showReminder && (
        <ReminderModal
          videoId={video.id}
          videoTitle={video.title}
          existing={existingReminder}
          onClose={() => setShowReminder(false)}
        />
      )}

      {showEdit && (
        <AddVideoModal
          editId={video.id}
          onClose={() => {
            setShowEdit(false);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
