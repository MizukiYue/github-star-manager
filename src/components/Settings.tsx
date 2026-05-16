import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import {
  saveToken,
  getAiConfig,
  saveAiConfig,
  fetchModels,
  ModelInfo,
  getOAuthConfig,
  saveOAuthConfig,
  startOAuth,
  waitOAuthCallback,
} from "@/lib/commands";
import { useSync } from "@/hooks/useSync";
import { Key, Clock, Info, Sparkles, RefreshCw, ChevronDown, Github, Loader2, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataManager } from "@/components/DataManager";

type SettingsTab = "account" | "ai" | "sync" | "about";

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "account", label: "账号" },
    { id: "ai", label: "AI 配置" },
    { id: "sync", label: "同步" },
    { id: "about", label: "关于" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 标签栏 */}
      <div className="border-b border-border px-6">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg mx-auto">
          {activeTab === "account" && <AccountTab />}
          {activeTab === "ai" && <AiTab />}
          {activeTab === "sync" && <SyncTab />}
          {activeTab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

// ===== 账号标签页 =====
function AccountTab() {
  const { token, setToken, setShowSettings } = useAppStore();
  const [inputToken, setInputToken] = useState(token || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // OAuth
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthSaving, setOauthSaving] = useState(false);
  const [oauthMessage, setOauthMessage] = useState("");
  const [oauthLoggingIn, setOauthLoggingIn] = useState(false);
  const [showOAuthConfig, setShowOAuthConfig] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const config = await getOAuthConfig();
        setOauthClientId(config.client_id || "");
        setOauthClientSecret(config.client_secret || "");
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!inputToken.trim()) {
      setMessage("请输入 Token");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await saveToken(inputToken.trim());
      setToken(inputToken.trim());
      setMessage("Token 保存成功！");
      setTimeout(() => setShowSettings(false), 1000);
    } catch (err) {
      setMessage(`保存失败: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOAuth = async () => {
    if (!oauthClientId.trim() || !oauthClientSecret.trim()) {
      setOauthMessage("请填写 Client ID 和 Client Secret");
      return;
    }
    setOauthSaving(true);
    setOauthMessage("");
    try {
      await saveOAuthConfig(oauthClientId.trim(), oauthClientSecret.trim());
      setOauthMessage("OAuth 配置保存成功！");
    } catch (err) {
      setOauthMessage(`保存失败: ${err}`);
    } finally {
      setOauthSaving(false);
    }
  };

  const handleOAuthLogin = async () => {
    setOauthLoggingIn(true);
    setOauthMessage("");
    try {
      const { auth_url, port } = await startOAuth();
      window.open(auth_url, "_blank");
      setOauthMessage("已打开浏览器，请完成 GitHub 授权...");
      const accessToken = await waitOAuthCallback(port);
      setToken(accessToken);
      setInputToken(accessToken);
      setOauthMessage("GitHub OAuth 登录成功！");
      setTimeout(() => setShowSettings(false), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOauthMessage(`登录失败: ${msg}`);
    } finally {
      setOauthLoggingIn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* OAuth 登录 */}
      <div className="space-y-3 p-4 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-foreground" />
          <h3 className="text-sm font-medium">GitHub OAuth 登录</h3>
        </div>

        {token ? (
          <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
            <span className="text-xs">已登录（Token 已配置）</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            通过 OAuth 登录或手动填写 Token 来连接 GitHub
          </p>
        )}

        <button
          onClick={handleOAuthLogin}
          disabled={oauthLoggingIn || (!oauthClientId && !oauthClientSecret)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors",
            "bg-[#24292f] text-white hover:bg-[#24292f]/90 dark:bg-[#f0f0f0] dark:text-[#24292f] dark:hover:bg-[#f0f0f0]/90",
            (oauthLoggingIn || (!oauthClientId && !oauthClientSecret)) && "opacity-50 cursor-not-allowed"
          )}
        >
          {oauthLoggingIn ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {oauthLoggingIn ? "等待浏览器授权..." : "使用 GitHub OAuth 登录"}
        </button>

        {oauthMessage && (
          <p className="text-xs text-muted-foreground">{oauthMessage}</p>
        )}

        <button
          onClick={() => setShowOAuthConfig(!showOAuthConfig)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showOAuthConfig ? "收起 OAuth 配置" : "配置 OAuth App（首次使用需配置）"}
        </button>

        {showOAuthConfig && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client ID</label>
              <input
                type="text"
                value={oauthClientId}
                onChange={(e) => setOauthClientId(e.target.value)}
                placeholder="Ov23li..."
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client Secret</label>
              <input
                type="password"
                value={oauthClientSecret}
                onChange={(e) => setOauthClientSecret(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleSaveOAuth}
              disabled={oauthSaving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {oauthSaving ? "保存中..." : "保存 OAuth 配置"}
            </button>
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>如何创建 OAuth App：</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>
                    访问{" "}
                    <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      GitHub Developer Settings
                    </a>
                  </li>
                  <li>点击 "New OAuth App"</li>
                  <li>Homepage URL 填 http://localhost</li>
                  <li>Callback URL 填 http://127.0.0.1/callback</li>
                  <li>创建后复制 Client ID 和 Secret</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 手动 Token */}
      <div className="space-y-3 p-4 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium">手动填写 Token</h3>
          <span className="text-xs text-muted-foreground">（备选方案）</span>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            value={inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存 Token"}
          </button>
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-muted">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              访问{" "}
              <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                GitHub Settings &rarr; Tokens
              </a>
              ，创建 Personal Access Token（勾选 read:user 权限）
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== AI 配置标签页 =====
function AiTab() {
  const [aiApiUrl, setAiApiUrl] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const config = await getAiConfig();
        setAiApiUrl(config.api_url || "");
        setAiApiKey(config.api_key || "");
        setAiModel(config.model || "");
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const handleSaveAi = async () => {
    if (!aiApiUrl.trim() || !aiApiKey.trim()) {
      setAiMessage("请填写 API 地址和 Key");
      return;
    }
    setAiSaving(true);
    setAiMessage("");
    try {
      await saveAiConfig(aiApiUrl.trim(), aiApiKey.trim(), aiModel.trim() || "gpt-3.5-turbo");
      setAiMessage("AI 配置保存成功！");
    } catch (err) {
      setAiMessage(`保存失败: ${err}`);
    } finally {
      setAiSaving(false);
    }
  };

  const handleFetchModels = async () => {
    if (!aiApiUrl.trim() || !aiApiKey.trim()) {
      setModelsError("请先填写 API 地址和 Key");
      return;
    }
    setLoadingModels(true);
    setModelsError("");
    try {
      const result = await fetchModels(aiApiUrl.trim(), aiApiKey.trim());
      setModels(result);
      setShowModelDropdown(true);
      if (result.length === 0) setModelsError("未获取到可用模型");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setModelsError(msg);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 p-4 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-medium">AI 总结服务</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              API 地址（兼容 OpenAI 格式）
            </label>
            <input
              type="text"
              value={aiApiUrl}
              onChange={(e) => setAiApiUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">模型名称</label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="点击右侧按钮拉取可用模型"
                    className="w-full px-3 py-2 pr-8 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {models.length > 0 && (
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleFetchModels}
                  disabled={loadingModels}
                  className={cn(
                    "px-3 py-2 rounded-md border border-input text-sm hover:bg-accent transition-colors flex items-center gap-1.5",
                    loadingModels && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loadingModels && "animate-spin")} />
                  <span className="whitespace-nowrap">{loadingModels ? "拉取中" : "拉取模型"}</span>
                </button>
              </div>

              {showModelDropdown && models.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-card border border-border rounded-md shadow-lg py-1">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setAiModel(m.id); setShowModelDropdown(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors",
                        aiModel === m.id && "bg-accent font-medium"
                      )}
                    >
                      <span>{m.id}</span>
                      {m.owned_by && (
                        <span className="ml-2 text-xs text-muted-foreground">({m.owned_by})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {modelsError && <p className="text-xs text-destructive mt-1">{modelsError}</p>}
            {models.length > 0 && !showModelDropdown && (
              <p className="text-xs text-muted-foreground mt-1">已获取 {models.length} 个可用模型</p>
            )}
          </div>

          <button
            onClick={handleSaveAi}
            disabled={aiSaving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {aiSaving ? "保存中..." : "保存配置"}
          </button>
          {aiMessage && <p className="text-sm text-muted-foreground">{aiMessage}</p>}
        </div>
      </div>

      {/* 说明 */}
      <div className="flex items-start gap-2 p-4 rounded-lg bg-muted">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>支持任何兼容 OpenAI Chat Completions 格式的 API：</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>DeepSeek: https://api.deepseek.com/v1</li>
            <li>通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1</li>
            <li>OpenAI: https://api.openai.com/v1</li>
            <li>本地 Ollama: http://localhost:11434/v1</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ===== 同步标签页 =====
function SyncTab() {
  const { lastSyncTime, syncProgress } = useSync();

  return (
    <div className="space-y-6">
      <div className="space-y-3 p-4 border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium">同步状态</h3>
        </div>
        <div className="text-sm text-muted-foreground space-y-2">
          <div className="flex items-center justify-between">
            <span>上次同步</span>
            <span className="font-medium text-foreground">{lastSyncTime || "从未同步"}</span>
          </div>
          {syncProgress && (
            <div className="p-2 rounded-md bg-muted text-xs">{syncProgress}</div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 p-4 rounded-lg bg-muted">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p>点击左侧边栏的「同步 Stars」按钮即可拉取最新的 GitHub Star 仓库数据。</p>
          <p className="mt-1">同步会自动获取所有已 Star 的仓库信息，包括描述、语言、Star 数等。</p>
        </div>
      </div>

      {/* 数据导入导出 */}
      <div className="p-4 border border-border rounded-lg">
        <DataManager />
      </div>
    </div>
  );
}

// ===== 关于标签页 =====
function AboutTab() {
  return (
    <div className="space-y-6">
      {/* 应用信息 */}
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg">
          <span className="text-3xl">⭐</span>
        </div>
        <h2 className="text-xl font-bold">GitHub Star Manager</h2>
        <p className="text-sm text-muted-foreground mt-1">v0.1.0</p>
        <p className="text-sm text-muted-foreground mt-3 max-w-sm">
          一个本地优先的 GitHub Star 仓库管理工具，支持标签分类、全文搜索、AI 智能分析。
        </p>
      </div>

      {/* 功能特性 */}
      <div className="space-y-3 p-4 border border-border rounded-lg">
        <h3 className="text-sm font-medium">功能特性</h3>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>同步并本地管理所有 GitHub Star 仓库</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>自定义标签分类，支持 AI 自动打标</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>FTS5 全文搜索，按语言、标签、Stars 数筛选</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>AI 项目分析：读取 README 和代码，生成结构化总结</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>GitHub OAuth 登录，数据存储在本地 SQLite</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>深色/浅色主题切换</span>
          </li>
        </ul>
      </div>

      {/* 技术栈 */}
      <div className="space-y-3 p-4 border border-border rounded-lg">
        <h3 className="text-sm font-medium">技术栈</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Tauri v2</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span>React 18</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Rust</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Tailwind CSS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>SQLite + FTS5</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>OpenAI API</span>
          </div>
        </div>
      </div>

      {/* 底部 */}
      <div className="text-center text-xs text-muted-foreground pt-2">
        <p>Built with Tauri + React + Rust</p>
      </div>
    </div>
  );
}
