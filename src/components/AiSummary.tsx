import { useState, useEffect } from "react";
import { summarizeRepo, getCachedSummary, aiAutoTag, SummaryResult } from "@/lib/commands";
import { Sparkles, X, Loader2, RefreshCw, Tag, FileCode, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiSummaryProps {
  repoId: number;
  fullName: string;
  open: boolean;
  onClose: () => void;
  onTagsApplied?: () => void;
}

const SOURCE_LABELS: Record<string, { label: string; icon: typeof BookOpen }> = {
  readme: { label: "基于 README", icon: BookOpen },
  "readme+code": { label: "README + 代码分析", icon: FileCode },
  code: { label: "基于代码分析", icon: FileCode },
};

export function AiSummary({ repoId, fullName, open, onClose, onTagsApplied }: AiSummaryProps) {
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingTags, setApplyingTags] = useState(false);
  const [tagsApplied, setTagsApplied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setTagsApplied(false);

    const loadCached = async () => {
      try {
        const cached = await getCachedSummary(fullName);
        if (cached) {
          setResult(cached);
        } else {
          handleSummarize();
        }
      } catch {
        handleSummarize();
      }
    };
    loadCached();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fullName]);

  const handleSummarize = async () => {
    setLoading(true);
    setError(null);
    setTagsApplied(false);
    try {
      const res = await summarizeRepo(fullName);
      setResult(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTags = async () => {
    setApplyingTags(true);
    try {
      await aiAutoTag(repoId, fullName);
      setTagsApplied(true);
      onTagsApplied?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setApplyingTags(false);
    }
  };

  if (!open) return null;

  const sourceInfo = result ? SOURCE_LABELS[result.source] || SOURCE_LABELS["readme"] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold">AI 项目分析</h2>
          </div>
          <div className="flex items-center gap-1">
            {result && !loading && (
              <button
                onClick={handleSummarize}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="重新生成"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 仓库名 + 数据来源 */}
        <div className="px-4 pt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{fullName}</p>
          {sourceInfo && !loading && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              <sourceInfo.icon className="w-3 h-3" />
              {sourceInfo.label}
            </span>
          )}
        </div>

        {/* 内容 */}
        <div className="p-4 min-h-[160px] max-h-[60vh] overflow-y-auto space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">正在分析项目（可能读取代码）...</span>
            </div>
          )}

          {error && !loading && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={handleSummarize}
                className="text-xs text-primary hover:underline"
              >
                重试
              </button>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Markdown 渲染的总结内容 */}
              <div className="ai-markdown text-sm text-foreground leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.summary}
                </ReactMarkdown>
              </div>

              {/* 建议标签 */}
              {result.suggested_tags.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      建议标签
                    </span>
                    {!tagsApplied ? (
                      <button
                        onClick={handleApplyTags}
                        disabled={applyingTags}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors",
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                          applyingTags && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {applyingTags ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Tag className="w-3 h-3" />
                        )}
                        {applyingTags ? "应用中..." : "应用标签"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Check className="w-3 h-3" />
                        已应用
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.suggested_tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
