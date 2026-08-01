import { useState } from 'react';
import { useAuth } from '../lib/auth';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) setError(err);
      } else {
        const { error: err } = await signUp(email.trim(), password);
        if (err) {
          setError(err);
        } else {
          setSuccess('注册成功！请检查邮箱确认链接（若开启了邮件验证），或直接登录。');
          setMode('login');
        }
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">📊 VideoVault</div>
        <h1>{mode === 'login' ? '欢迎回来' : '创建账号'}</h1>
        <p className="auth-subtitle">跨平台视频收藏 · AI 知识管理</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? '处理中...' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <span>
              还没有账号？{' '}
              <button className="link-btn" onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>
                立即注册
              </button>
            </span>
          ) : (
            <span>
              已有账号？{' '}
              <button className="link-btn" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
                去登录
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
