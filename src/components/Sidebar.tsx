import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import type { Page } from '../types';

interface SidebarProps {
  currentPage: Page;
  onChange: (p: Page) => void;
}

const ITEMS: { page: Page; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '📋', label: '数据看板' },
  { page: 'library', icon: '🎬', label: '视频库' },
  { page: 'reports', icon: '📝', label: 'AI 报告' },
  { page: 'graph', icon: '🕸️', label: '知识图谱' },
  { page: 'settings', icon: '⚙️', label: '设置' },
];

export default function Sidebar({ currentPage, onChange }: SidebarProps) {
  const { videos, reports } = useStore();
  const { user, isLocal, signOut } = useAuth();
  const badge: Record<Page, number> = {
    dashboard: 0,
    library: videos.length,
    reports: reports.length,
    graph: 0,
    settings: 0,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="icon">📊</span> VideoVault
      </div>
      {ITEMS.map((it) => (
        <button
          key={it.page}
          className={'nav-item' + (currentPage === it.page ? ' active' : '')}
          onClick={() => onChange(it.page)}
        >
          <span>{it.icon}</span> {it.label}
          {badge[it.page] > 0 && <span className="badge">{badge[it.page]}</span>}
        </button>
      ))}
      <div className="sidebar-footer">
        {user && <div className="user-email">{user.email}</div>}
        {!isLocal && (
          <button className="nav-item logout-btn" onClick={signOut}>
            <span>🚪</span> 退出登录
          </button>
        )}
        {isLocal && <div className="user-email">本地模式</div>}
      </div>
    </aside>
  );
}
