import { Repo, Tag, createTag, addTagToRepo, removeTagFromRepo } from "@/lib/commands";
import { cn, formatNumber, timeAgo, buildTagTree, flattenTagTree } from "@/lib/utils";
import { Star, ExternalLink, Tag as TagIcon, Plus, Sparkles, X, StickyNote, BookOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AiSummary } from "@/components/AiSummary";
import { NoteEditor } from "@/components/NoteEditor";
import { ReadmePreview } from "@/components/ReadmePreview";

const QUICK_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#22c55e", "#06b6d4", "#3b82f6", "#64748b", "#eab308",
];

interface RepoCardProps {
  repo: Repo;
  allTags: Tag[];
  onToggleTag: (repoId: number, tagId: number, hasTag: boolean) => void;
  onRefresh?: () => void;
}

export function RepoCard({ repo, allTags, onToggleTag, onRefresh }: RepoCardProps) {
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [showReadme, setShowReadme] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showTagMenu && inputRef.current) {
      // 不自动聚焦，避免干扰选择已有标签
    }
  }, [showTagMenu]);

  const handleToggleTag = (tagId: number) => {
    const hasTag = repo.tags.some((t) => t.id === tagId);
    onToggleTag(repo.id, tagId, hasTag);
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await removeTagFromRepo(repo.id, tagId);
      onRefresh?.();
    } catch {
      // ignore
    }
  };

  const handleCreateAndApply = async () => {
    const name = newTagName.trim();
    if (!name || creating) return;

    setCreating(true);
    try {
      const color = QUICK_COLORS[name.length % QUICK_COLORS.length];
      const tag = await createTag(name, color);
      await addTagToRepo(repo.id, tag.id);
      setNewTagName("");
      setShowTagMenu(false);
      onRefresh?.();
    } catch {
      const existing = allTags.find(
        (t) => t.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        try {
          await addTagToRepo(repo.id, existing.id);
          setNewTagName("");
          setShowTagMenu(false);
          onRefresh?.();
        } catch {
          // ignore
        }
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="group p-4 border border-border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all bg-card">
        {/* 头部：头像 + 仓库名 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {repo.owner_avatar_url && (
              <img
                src={repo.owner_avatar_url}
                alt={repo.owner_login}
                className="w-8 h-8 rounded-full flex-shrink-0"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <a
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline truncate block"
              >
                {repo.full_name}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              {formatNumber(repo.stargazers_count)}
            </span>
            <button
              onClick={() => setShowNote(!showNote)}
              className={cn(
                "p-1 rounded text-xs transition-all",
                showNote
                  ? "text-amber-500 bg-amber-500/10"
                  : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100"
              )}
              title="笔记"
            >
              <StickyNote className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowReadme(true)}
              className="p-1 rounded text-xs text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
              title="查看 README"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowAiSummary(true)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-all"
              title="AI 项目分析"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 描述 */}
        {repo.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {repo.description}
          </p>
        )}

        {/* 底部：语言 + 标签 + 时间 */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {repo.language && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground">
                {repo.language}
              </span>
            )}
            {repo.tags.map((tag) => {
              const tagDisplayName = tag.name.includes("/") ? tag.name.split("/").pop() : tag.name;
              return (
              <span
                key={tag.id}
                className="group/tag inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: tag.color + "20",
                  color: tag.color,
                }}
                title={tag.name}
              >
                <TagIcon className="w-3 h-3" />
                {tagDisplayName}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="ml-0.5 rounded-full opacity-0 group-hover/tag:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
                  title="移除标签"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              );
            })}
            {/* 添加标签按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowTagMenu(!showTagMenu)}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-all"
              >
                <Plus className="w-3 h-3" />
              </button>
              {showTagMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-52 bg-card border border-border rounded-md shadow-lg z-10 py-1">
                  {allTags.length > 0 && (
                    <div className="max-h-48 overflow-y-auto">
                      {flattenTagTree(buildTagTree(allTags)).map(({ tag, depth, displayName }) => {
                        const hasTag = repo.tags.some((t) => t.id === tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => handleToggleTag(tag.id)}
                            className={cn(
                              "w-full flex items-center gap-2 py-1.5 text-xs hover:bg-accent transition-colors",
                              hasTag && "bg-accent"
                            )}
                            style={{ paddingLeft: `${depth * 12 + 12}px`, paddingRight: '12px' }}
                          >
                            <TagIcon
                              className="w-3 h-3 flex-shrink-0"
                              style={{ color: tag.color }}
                            />
                            <span className="truncate">{displayName}</span>
                            {hasTag && (
                              <span className="ml-auto text-primary">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {allTags.length > 0 && (
                    <div className="border-t border-border my-1" />
                  )}
                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateAndApply();
                          }
                          if (e.key === "Escape") {
                            setShowTagMenu(false);
                          }
                        }}
                        placeholder="新建标签..."
                        className="flex-1 min-w-0 px-2 py-1 rounded border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        onClick={handleCreateAndApply}
                        disabled={!newTagName.trim() || creating}
                        className="p-1 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {repo.starred_at && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {timeAgo(repo.starred_at)}
            </span>
          )}
        </div>

        {/* 笔记编辑器（内联展开） */}
        <NoteEditor
          repoId={repo.id}
          open={showNote}
          onClose={() => setShowNote(false)}
        />
      </div>

      {/* AI 总结弹窗 */}
      <AiSummary
        repoId={repo.id}
        fullName={repo.full_name}
        open={showAiSummary}
        onClose={() => setShowAiSummary(false)}
        onTagsApplied={onRefresh}
      />

      {/* README 预览弹窗 */}
      <ReadmePreview
        fullName={repo.full_name}
        htmlUrl={repo.html_url}
        open={showReadme}
        onClose={() => setShowReadme(false)}
      />
    </>
  );
}
