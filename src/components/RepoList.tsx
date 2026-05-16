import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { RepoCard } from "@/components/RepoCard";
import { addTagToRepo, removeTagFromRepo, getRepos, searchRepos, getTotalRepoCount } from "@/lib/commands";
import { Loader2, Inbox, ChevronLeft, ChevronRight, ArrowUpNarrowWide, ArrowDownWideNarrow } from "lucide-react";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "starred", label: "收藏时间" },
  { value: "stars", label: "Stars 数量" },
  { value: "updated", label: "更新时间" },
] as const;

export function RepoList() {
  const {
    repos,
    totalCount,
    loading,
    currentPage,
    pageSize,
    tags,
    selectedLanguage,
    selectedTagId,
    searchQuery,
    sortBy,
    sortOrder,
    setRepos,
    setTotalCount,
    setCurrentPage,
    setLoading,
    setSortBy,
    toggleSortOrder,
  } = useAppStore();

  const totalPages = Math.ceil(totalCount / pageSize);

  const refreshRepos = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await searchRepos(searchQuery.trim());
        setRepos(results);
        setTotalCount(results.length);
      } else {
        const results = await getRepos({
          language: selectedLanguage,
          tag_id: selectedTagId,
          search: null,
          sort_by: sortBy,
          sort_order: sortOrder,
          page: currentPage,
          page_size: pageSize,
        });
        setRepos(results);
        const total = await getTotalRepoCount();
        setTotalCount(total);
      }
    } catch (err) {
      console.error("Failed to refresh repos:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedLanguage, selectedTagId, sortBy, sortOrder, currentPage, pageSize, setRepos, setTotalCount, setLoading]);

  const handleToggleTag = useCallback(
    async (repoId: number, tagId: number, hasTag: boolean) => {
      try {
        if (hasTag) {
          await removeTagFromRepo(repoId, tagId);
        } else {
          await addTagToRepo(repoId, tagId);
        }
        await refreshRepos();
      } catch (err) {
        console.error("Failed to toggle tag:", err);
      }
    },
    [refreshRepos]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Inbox className="w-12 h-12" />
          <p className="text-sm">暂无仓库</p>
          <p className="text-xs">点击左侧「同步 Stars」获取你的收藏仓库</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 排序栏 */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border">
        <span className="text-sm text-muted-foreground">
          共 {totalCount} 个仓库
        </span>
        <div className="flex items-center gap-1.5">
          {/* 排序方向切换 */}
          <button
            onClick={toggleSortOrder}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={sortOrder === "desc" ? "当前：降序（点击切换为升序）" : "当前：升序（点击切换为降序）"}
          >
            {sortOrder === "desc" ? (
              <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpNarrowWide className="w-3.5 h-3.5" />
            )}
          </button>
          {/* 排序字段选择 */}
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded text-xs transition-colors",
                sortBy === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 仓库列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-3">
          {repos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              allTags={tags}
              onToggleTag={handleToggleTag}
              onRefresh={refreshRepos}
            />
          ))}
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border">
          <span className="text-sm text-muted-foreground">
            第 {currentPage}/{totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className={cn(
                "p-1.5 rounded-md hover:bg-accent transition-colors",
                currentPage <= 1 && "opacity-50 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className={cn(
                "p-1.5 rounded-md hover:bg-accent transition-colors",
                currentPage >= totalPages && "opacity-50 cursor-not-allowed"
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
