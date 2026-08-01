import { useState } from 'react';
import { useStore } from '../store';
import { testAIConnection } from '../lib/ai';
import { fetchNotionVideos } from '../lib/notion';
import { isSupabaseConfigured } from '../lib/supabase';
import type { AIConfig } from '../types';
import Modal from './Modal';

export default function Settings() {
  const {
    aiConfigs,
    addAIConfig,
    updateAIConfig,
    deleteAIConfig,
    folders,
    addFolder,
    deleteFolder,
    addVideo,
    requestNotificationPermission,
    showToast,
  } = useStore();

  const [showAddAI, setShowAddAI] = useState(false);
  const [editConfig, setEditConfig] = useState<AIConfig | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  const [notionToken, setNotionToken] = useState('');
  const [notionDb, setNotionDb] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const handleNotionImport = async () => {
    if (!notionToken.trim() || !notionDb.trim()) {
      showToast('请填写 Notion Token 与数据库 ID', true);
      return;
    }
    setImporting(true);
    setImportMsg('正在从 Notion 拉取数据…');
    try {
      const items = await fetchNotionVideos(notionToken.trim(), notionDb.trim());
      if (items.length === 0) {
        setImportMsg('未找到可导入的视频（需包含链接或标题属性）');
      } else {
        items.forEach((it) => addVideo(it));
        setImportMsg(`成功导入 ${items.length} 条收藏 ✅`);
        showToast(`成功导入 ${items.length} 条收藏`);
      }
    } catch (e) {
      setImportMsg('导入失败：' + (e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>⚙️ 设置</h1>
        <p className="subtitle">管理 AI 模型、文件夹与系统配置</p>
      </header>

      {/* Supabase 状态 */}
      <section className="section">
        <h2>🗄️ 数据连接</h2>
        <div className="settings-status">
          <span className={'status-dot ' + (isSupabaseConfigured ? 'online' : 'offline')}></span>
          {isSupabaseConfigured ? 'Supabase 已连接' : '本地模式（未配置 Supabase）'}
        </div>
        {!isSupabaseConfigured && (
          <p className="hint-text">
            在 <code>.env</code> 中配置 <code>VITE_SUPABASE_URL</code> 和{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> 以启用云同步
          </p>
        )}
        <div className="settings-row">
          <button className="btn btn-outline btn-sm" onClick={requestNotificationPermission}>
            🔔 开启复习提醒桌面通知
          </button>
          <span className="hint-text">视频到期时通过浏览器通知提醒你复习</span>
        </div>
      </section>

      {/* AI 模型管理 */}
      <section className="section">
        <div className="section-header">
          <h2>🤖 AI 模型配置</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddAI(true)}>
            ➕ 添加模型
          </button>
        </div>

        {aiConfigs.length === 0 ? (
          <p className="empty-hint">
            尚未配置 AI 模型，将使用内置模拟 AI。添加自定义模型可获得更精准的总结。
          </p>
        ) : (
          <div className="ai-config-list">
            {aiConfigs.map((config) => (
              <AIConfigCard
                key={config.id}
                config={config}
                onEdit={() => setEditConfig(config)}
                onDelete={() => {
                  if (confirm('确定删除该模型配置吗？')) deleteAIConfig(config.id);
                }}
                onSetDefault={() => updateAIConfig(config.id, { isDefault: true })}
              />
            ))}
          </div>
        )}
      </section>

      {/* 文件夹管理 */}
      <section className="section">
        <h2>📁 文件夹管理</h2>
        <div className="folder-manage">
          <div className="folder-add-row">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="新建文件夹名称..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  addFolder(newFolderName.trim());
                  setNewFolderName('');
                }
              }}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (newFolderName.trim()) {
                  addFolder(newFolderName.trim());
                  setNewFolderName('');
                }
              }}
            >
              创建
            </button>
          </div>
          {folders.length > 0 && (
            <div className="folder-list">
              {folders.map((f) => (
                <div key={f.id} className="folder-item">
                  <span>{f.icon} {f.name}</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm(`删除文件夹「${f.name}」？其中视频不会被删除。`))
                        deleteFolder(f.id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Notion 数据导入 */}
      <section className="section">
        <h2>📥 Notion 数据导入</h2>
        <p className="hint-text">
          将 Notion 数据库中的收藏批量导入。需先在{' '}
          <a href="https://www.notion.com/my-integrations" target="_blank" rel="noopener noreferrer">
            Notion 集成
          </a>{' '}
          创建 Internal Integration，并把数据库共享给该集成。
        </p>
        <div className="notion-import">
          <input
            type="password"
            value={notionToken}
            onChange={(e) => setNotionToken(e.target.value)}
            placeholder="Notion Integration Token（secret_...）"
          />
          <input
            type="text"
            value={notionDb}
            onChange={(e) => setNotionDb(e.target.value)}
            placeholder="数据库 ID（数据库链接中 / 后的一段 ID）"
          />
          <button className="btn btn-primary btn-sm" onClick={handleNotionImport} disabled={importing}>
            {importing ? '⏳ 导入中…' : '⬇️ 导入收藏'}
          </button>
        </div>
        {importMsg && <p className="hint-text">{importMsg}</p>}
      </section>

      {showAddAI && (
        <AIConfigModal
          onClose={() => setShowAddAI(false)}
          onSave={(data) => {
            addAIConfig(data);
            setShowAddAI(false);
          }}
        />
      )}
      {editConfig && (
        <AIConfigModal
          config={editConfig}
          onClose={() => setEditConfig(null)}
          onSave={(data) => {
            updateAIConfig(editConfig.id, data);
            setEditConfig(null);
            showToast('模型配置已更新');
          }}
        />
      )}
    </div>
  );
}

// ─── AI Config Card ───────────────────────────────────────────

function AIConfigCard({
  config,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  config: AIConfig;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testAIConnection(config);
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div className={'ai-config-card' + (config.isDefault ? ' default' : '')}>
      <div className="ai-config-header">
        <div className="ai-config-name">
          {config.isDefault && <span className="default-badge">默认</span>}
          <strong>{config.name}</strong>
        </div>
        <span className="ai-config-provider">{config.provider}</span>
      </div>
      <div className="ai-config-details">
        <div className="ai-config-row">
          <span className="label">模型:</span> {config.modelName}
        </div>
        <div className="ai-config-row">
          <span className="label">地址:</span>{' '}
          <code>{config.apiBaseUrl}</code>
        </div>
        <div className="ai-config-row">
          <span className="label">密钥:</span>{' '}
          <code>{config.apiKey.slice(0, 8)}{'•'.repeat(12)}</code>
        </div>
      </div>
      {testResult && (
        <div className={'test-result ' + (testResult.success ? 'success' : 'error')}>
          {testResult.message}
        </div>
      )}
      <div className="ai-config-actions">
        <button className="btn btn-outline btn-sm" onClick={handleTest} disabled={testing}>
          {testing ? '⏳ 测试中...' : '🔌 测试连接'}
        </button>
        {!config.isDefault && (
          <button className="btn btn-outline btn-sm" onClick={onSetDefault}>
            ⭐ 设为默认
          </button>
        )}
        <button className="btn btn-outline btn-sm" onClick={onEdit}>
          ✏️ 编辑
        </button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─── AI Config Modal (Add / Edit) ─────────────────────────────

function AIConfigModal({
  config,
  onClose,
  onSave,
}: {
  config?: AIConfig;
  onClose: () => void;
  onSave: (data: Omit<AIConfig, 'id'>) => void;
}) {
  const [name, setName] = useState(config?.name ?? '');
  const [provider, setProvider] = useState(config?.provider ?? 'openai');
  const [apiBaseUrl, setApiBaseUrl] = useState(config?.apiBaseUrl ?? '');
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '');
  const [modelName, setModelName] = useState(config?.modelName ?? '');
  const [isDefault, setIsDefault] = useState(config?.isDefault ?? false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { showToast } = useStore();

  const handleTest = async () => {
    if (!apiBaseUrl.trim() || !apiKey.trim() || !modelName.trim()) {
      showToast('请先填写 API 地址、密钥和模型名称', true);
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testAIConnection({ apiBaseUrl, apiKey, modelName, provider });
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    if (!name.trim() || !apiBaseUrl.trim() || !apiKey.trim() || !modelName.trim()) {
      showToast('请填写所有必填字段', true);
      return;
    }
    onSave({ name: name.trim(), provider, apiBaseUrl: apiBaseUrl.trim(), apiKey: apiKey.trim(), modelName: modelName.trim(), isDefault });
  };

  return (
    <Modal onClose={onClose}>
      <h2>{config ? '✏️ 编辑 AI 模型' : '➕ 添加 AI 模型'}</h2>

      <div className="form-group">
        <label>配置名称 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：我的 GPT-4o"
        />
      </div>

      <div className="form-group">
        <label>提供商协议</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="openai">OpenAI 兼容</option>
          <option value="azure">Azure OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      <div className="form-group">
        <label>API Base URL *</label>
        <input
          type="text"
          value={apiBaseUrl}
          onChange={(e) => setApiBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <span className="hint-text">OpenAI 兼容接口地址，不需要加 /chat/completions</span>
      </div>

      <div className="form-group">
        <label>API Key *</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="form-group">
        <label>模型名称 *</label>
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="gpt-4o / deepseek-chat / qwen-max"
        />
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          设为默认模型
        </label>
      </div>

      {testResult && (
        <div className={'test-result ' + (testResult.success ? 'success' : 'error')}>
          {testResult.message}
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-outline" onClick={handleTest} disabled={testing}>
          {testing ? '⏳ 测试中...' : '🔌 测试连接'}
        </button>
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
