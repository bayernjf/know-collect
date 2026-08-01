import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useStore } from '../store';
import { parseVideoUrl, fetchVideoMeta } from '../lib/urlParser';
import type { Platform, VideoInput } from '../types';

interface AddVideoModalProps {
  editId?: string;
  initialUrl?: string;
  onClose: () => void;
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'douyin', label: '抖音' },
  { value: 'bilibili', label: 'B站' },
  { value: 'xiaohongshu', label: '小红书' },
];

export default function AddVideoModal({ editId, initialUrl, onClose }: AddVideoModalProps) {
  const { videos, addVideo, updateVideo, showToast } = useStore();
  const editing = editId ? videos.find((v) => v.id === editId) : null;

  const [platform, setPlatform] = useState<Platform>(
    editing?.platform ?? (initialUrl ? parseVideoUrl(initialUrl)?.platform ?? 'douyin' : 'douyin'),
  );
  const [url, setUrl] = useState(initialUrl ?? editing?.url ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [author, setAuthor] = useState(editing?.author ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [tags, setTags] = useState((editing?.tags ?? []).join(','));
  const [transcript, setTranscript] = useState(editing?.transcript ?? '');
  const [coverUrl, setCoverUrl] = useState(editing?.coverUrl ?? '');
  const [parsing, setParsing] = useState(false);

  // 链接变化时自动检测平台
  const handleUrlChange = (value: string) => {
    setUrl(value);
    const parsed = parseVideoUrl(value);
    if (parsed) {
      setPlatform(parsed.platform);
    }
  };

  // 尝试自动解析视频信息
  const handleParse = async () => {
    if (!url.trim()) return;
    setParsing(true);
    try {
      const meta = await fetchVideoMeta(url);
      if (meta) {
        if (meta.title) setTitle(meta.title);
        if (meta.author) setAuthor(meta.author);
        if (meta.description) setDescription(meta.description);
        if (meta.coverUrl) setCoverUrl(meta.coverUrl);
        showToast('视频信息已自动填充 ✅');
      } else {
        showToast('无法自动解析，请手动填写', true);
      }
    } catch {
      showToast('解析失败，请手动填写', true);
    } finally {
      setParsing(false);
    }
  };

  useEffect(() => {
    if (editing) {
      setPlatform(editing.platform);
      setUrl(editing.url);
      setTitle(editing.title);
      setAuthor(editing.author ?? '');
      setDescription(editing.description ?? '');
      setTags((editing.tags ?? []).join(','));
      setTranscript(editing.transcript ?? '');
      setCoverUrl(editing.coverUrl ?? '');
    }
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 浏览器插件传入链接时，自动解析元数据
  useEffect(() => {
    if (initialUrl) {
      handleParse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!url.trim() || !title.trim()) {
      showToast('请填写链接和标题', true);
      return;
    }
    const data: VideoInput = {
      platform,
      url: url.trim(),
      title: title.trim(),
      author: author.trim(),
      description: description.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      transcript: transcript.trim(),
      coverUrl: coverUrl.trim(),
    };
    if (editing) {
      updateVideo(editing.id, data);
      showToast('视频已更新 ✅');
    } else {
      addVideo(data);
      showToast('视频已添加 ✅');
    }
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2>{editing ? '✏️ 编辑视频' : '➕ 添加收藏视频'}</h2>

      <div className="form-group">
        <label>平台</label>
        <div className="platform-select">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={
                'platform-option ' + p.value + (platform === p.value ? ' active' : '')
              }
              onClick={() => setPlatform(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>视频链接 *</label>
        <div className="url-input-row">
          <input
            type="text"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://..."
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleParse}
            disabled={parsing || !url.trim()}
          >
            {parsing ? '解析中...' : '🔍 解析'}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>标题 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="视频标题"
        />
      </div>

      <div className="form-group">
        <label>作者</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="创作者名称"
        />
      </div>

      <div className="form-group">
        <label>标签（逗号分隔）</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="技术, AI, 教程"
        />
      </div>

      <div className="form-group">
        <label>描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="视频描述..."
        />
      </div>

      <div className="form-group">
        <label>文稿 / 字幕</label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={4}
          placeholder="粘贴视频文稿，AI 总结将更精准..."
        />
      </div>

      <div className="form-actions">
        <button className="btn btn-outline" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          💾 保存
        </button>
      </div>
    </Modal>
  );
}
