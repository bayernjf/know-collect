import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useAIModals } from '../useAIModals';
import { exportData } from '../utils';
import { parseCSV, parseJSONBackup } from '../lib/import';
import VideoCard from './VideoCard';
import AddVideoModal from './AddVideoModal';
import VideoDetailModal from './VideoDetailModal';
import type { Video } from '../types';

type Filter = 'all' | 'douyin' | 'bilibili' | 'xiaohongshu' | 'summarized' | 'unsummarized' | 'unread' | 'reading' | 'done' | 'starred';

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'douyin', label: '抖音' },
  { key: 'bilibili', label: 'B站' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'summarized', label: '已总结' },
  { key: 'unsummarized', label: '待总结' },
  { key: 'unread', label: '待看' },
  { key: 'reading', label: '在看' },
  { key: 'done', label: '已看' },
  { key: 'starred', label: '精华' },
];

export default function Library({
  initialAddUrl,
  onAddUrlConsumed,
}: {
  initialAddUrl?: string | null;
  onAddUrlConsumed?: () => void;
}) {
  const { videos, folders, addVideo, deleteVideos, showToast } = useStore();
  const {
    summarizeAll,
    summarizeSelected,
    summarizeOne,
    generateReport,
    reportModals,
  } = useAIModals();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 浏览器插件一键收藏：打开添加弹窗并预填链接
  useEffect(() => {
    if (initialAddUrl) {
      setShowAdd(true);
      onAddUrlConsumed?.();
    }
  }, [initialAddUrl, onAddUrlConsumed]);

  const filtered = useMemo(() => {
    let list = [...videos];
    if (filter === 'summarized') list = list.filter((v) => v.summary);
    else if (filter === 'unsummarized') list = list.filter((v) => !v.summary);
    else if (['unread', 'reading', 'done', 'starred'].includes(filter))
      list = list.filter((v) => (v.status || 'unread') === filter);
    else if (filter !== 'all') list = list.filter((v) => v.platform === filter);

    if (folderFilter) list = list.filter((v) => v.folderId === folderFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.author || '').toLowerCase().includes(q) ||
          (v.description || '').toLowerCase().includes(q) ||
          (v.summary || '').toLowerCase().includes(q) ||
          (v.transcript || '').toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [videos, filter, search, folderFilter]);

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const countUnsummarized = useMemo(
    () => videos.filter((v) => !v.summary).length,
    [videos],
  );

  const generateFromSelected = () => {
    const sel = videos.filter((v) => selected.has(v.id) && v.summary);
    if (sel.length === 0) {
      showToast('所选视频未生成总结', true);
      return;
    }
    generateReport(sel);
  };

  const deleteSelected = () => {
    if (!confirm(`确定删除选中的 ${selected.size} 个视频吗？`)) return;
    deleteVideos([...selected]);
    setSelected(new Set());
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      let items: ReturnType<typeof parseCSV> = [];
      if (file.name.endsWith('.json')) {
        items = parseJSONBackup(text);
      } else if (file.name.endsWith('.csv')) {
        items = parseCSV(text);
      } else {
        showToast('不支持的文件格式，请使用 CSV 或 JSON 文件', true);
        return;
      }
      if (items.length === 0) {
        showToast('未找到可导入的数据', true);
        return;
      }
      if (!confirm(`检测到 ${items.length} 条记录，确定导入吗？`)) return;
      items.forEach((item) => addVideo(item));
      showToast(`成功导入 ${items.length} 个视频`);
    };
    reader.readAsText(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>🎬 视频库</h1>
        <p className="subtitle">管理来自多个平台的收藏视频</p>
      </header>

      <div className="tabs">
        {TABS.map((t) => {
          const count =
            t.key === 'all'
              ? videos.length
              : t.key === 'summarized'
              ? videos.filter((v) => v.summary).length
              : t.key === 'unsummarized'
              ? countUnsummarized
              : videos.filter((v) => v.platform === t.key).length;
          return (
            <button
              key={t.key}
              className={'tab' + (filter === t.key ? ' active' : '')}
              onClick={() => changeFilter(t.key)}
            >
              {t.label} <span className="tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 搜索标题、作者、标签、总结内容..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {folders.length > 0 && (
          <select
            className="folder-filter-select"
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
          >
            <option value="">所有文件夹</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon} {f.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          ➕ 添加视频
        </button>
        <button className="btn btn-outline" onClick={summarizeAll}>
          🤖 批量总结 ({countUnsummarized})
        </button>
        <button
          className="btn btn-outline"
          onClick={() => exportData(videos, [])}
        >
          📤 导出数据
        </button>
        <button
          className="btn btn-outline"
          onClick={() => fileRef.current?.click()}
        >
          📥 导入数据
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="empty-hint">没有符合条件的视频</p>
      ) : (
        <div className="video-grid">
          {filtered.map((v: Video) => (
            <VideoCard
              key={v.id}
              video={v}
              onOpen={setDetailId}
              selectable
              selected={selected.has(v.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="batch-bar show">
          <div className="batch-count">
            已选择 <strong>{selected.size}</strong> 个视频
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => summarizeSelected(selected)}
            >
              🤖 总结选中
            </button>
            <button className="btn btn-outline btn-sm" onClick={generateFromSelected}>
              📝 生成报告
            </button>
            <button className="btn btn-danger btn-sm" onClick={deleteSelected}>
              🗑️ 批量删除
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setSelected(new Set())}
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <AddVideoModal
          initialUrl={initialAddUrl ?? undefined}
          onClose={() => setShowAdd(false)}
        />
      )}
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
