import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useSync } from "@/hooks/useSync";
import { useTags } from "@/hooks/useTags";
import { useRepos } from "@/hooks/useRepos";
import { TagManager } from "@/components/TagManager";
import {
  Star,
  RefreshCw,
  Settings,
  Tag,
  Moon,
  Sun,
  Code2,
  Tags,
  BarChart3,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export function Sidebar() {
  const [showTagManager, setShowTagManager] = useState(false);
  const {
    selectedLanguage,
    selectedTagId,
    languages,
    totalCount,
    darkMode,
    syncing,
    showDashboard,
    setSelectedLanguage,
    setSelectedTagId,
    setShowSettings,
    setShowDashboard,
    toggleDarkMode,
  } = useAppStore();

  const { tags } = useTags();
  const { sync } = useSync();
  const { refresh, refreshLanguages } = useRepos();

  const handleSync = async () => {
    try {
      await sync();
      await refresh();
      await refreshLanguages();
    } catch {
      // error handled in useSync
    }
  };

  return (
    <>
      <aside className="w-64 h-full border-r border-border bg-card flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <h1 className="text-lg font-semibold">Star Manager</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            共 {totalCount} 个收藏仓库
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="p-3 border-b border-border space-y-1">
          <button
            onClick={handleSync}
            disabled={syncing}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
              "hover:bg-accent transition-colors",
              syncing && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw
              className={cn("w-4 h-4", syncing && "animate-spin")}
            />
            {syncing ? "同步中..." : "同步 Stars"}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
          >
            <Settings className="w-4 h-4" />
            设置
          </button>
        </div>

        {/* 导航 */}
        <div className="p-3 border-b border-border space-y-0.5">
          <button
            onClick={() => {
              setSelectedLanguage(null);
              setSelectedTagId(null);
              setShowSettings(false);
              setShowDashboard(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
              "hover:bg-accent transition-colors",
              !selectedLanguage && !selectedTagId && !showDashboard && "bg-accent font-medium"
            )}
          >
            <Star className="w-4 h-4" />
            全部仓库
          </button>
          <button
            onClick={() => setShowDashboard(true)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
              "hover:bg-accent transition-colors",
              showDashboard && "bg-accent font-medium"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            统计面板
          </button>
        </div>

        {/* 标签列表 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2 px-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                标签
              </h3>
              <button
                onClick={() => setShowTagManager(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="管理标签"
              >
                <Tags className="w-3.5 h-3.5" />
              </button>
            </div>
            {tags.length > 0 ? (
              <div className="space-y-0.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setSelectedTagId(
                        selectedTagId === tag.id ? null : tag.id
                      );
                      setSelectedLanguage(null);
                      setShowSettings(false);
                      setShowDashboard(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                      "hover:bg-accent transition-colors",
                      selectedTagId === tag.id && "bg-accent font-medium"
                    )}
                  >
                    <Tag
                      className="w-3.5 h-3.5"
                      style={{ color: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-3 text-xs text-muted-foreground">
                点击上方图标创建标签
              </p>
            )}
          </div>

          {/* 语言列表 */}
          {languages.length > 0 && (
            <div className="p-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-3">
                语言
              </h3>
              <div className="space-y-0.5">
                {languages.slice(0, 15).map((lang) => (
                  <button
                    key={lang.language}
                    onClick={() => {
                      setSelectedLanguage(
                        selectedLanguage === lang.language
                          ? null
                          : lang.language
                      );
                      setSelectedTagId(null);
                      setShowSettings(false);
                      setShowDashboard(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm",
                      "hover:bg-accent transition-colors",
                      selectedLanguage === lang.language &&
                        "bg-accent font-medium"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5" />
                      <span className="truncate">{lang.language}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(lang.count)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-3 border-t border-border">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
          >
            {darkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            {darkMode ? "浅色模式" : "深色模式"}
          </button>
        </div>
      </aside>

      {/* 标签管理弹窗 */}
      <TagManager
        open={showTagManager}
        onClose={() => setShowTagManager(false)}
      />
    </>
  );
}
