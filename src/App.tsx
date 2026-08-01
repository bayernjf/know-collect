import { useEffect, useState } from 'react';
import type { Page } from './types';
import { useAuth } from './lib/auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Library from './components/Library';
import Reports from './components/Reports';
import Settings from './components/Settings';
import KnowledgeGraph from './components/KnowledgeGraph';
import AuthPage from './components/AuthPage';

export default function App() {
  const { user, loading, isLocal } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [initialAddUrl, setInitialAddUrl] = useState<string | null>(null);

  // 浏览器插件一键收藏：?add=<encoded url> 预填添加弹窗
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const add = params.get('add');
    if (add) {
      setInitialAddUrl(add);
      params.delete('add');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', newUrl);
      setPage('library');
    }
  }, []);

  // 加载中
  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">📊 VideoVault</div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  // 未配置 Supabase 时直接进入（本地模式）
  // 已配置但未登录时显示登录页
  if (!isLocal && !user) {
    return <AuthPage />;
  }

  return (
    <div className="app">
      <Sidebar currentPage={page} onChange={setPage} />
      <main className="main" id="main-content">
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'library' && (
          <Library
            initialAddUrl={initialAddUrl}
            onAddUrlConsumed={() => setInitialAddUrl(null)}
          />
        )}
        {page === 'reports' && <Reports />}
        {page === 'settings' && <Settings />}
        {page === 'graph' && <KnowledgeGraph />}
      </main>
    </div>
  );
}
