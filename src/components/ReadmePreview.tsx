import { useState, useEffect } from "react";
import { fetchRepoReadme } from "@/lib/commands";
import { BookOpen, X, Loader2, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface ReadmePreviewProps {
  fullName: string;
  htmlUrl: string;
  open: boolean;
  onClose: () => void;
}

function resolveGitHubUrl(src: string | undefined, fullName: string): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src.replace(
      /github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\//,
      "raw.githubusercontent.com/$1/$2/"
    );
  }
  const cleaned = src.replace(/^\.\//, "");
  return `https://raw.githubusercontent.com/${fullName}/HEAD/${cleaned}`;
}

export function ReadmePreview({ fullName, htmlUrl, open, onClose }: ReadmePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setContent(null);
    setError(null);
    setLoading(true);

    fetchRepoReadme(fullName)
      .then(setContent)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [open, fullName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[85vh] bg-card border border-border rounded-lg shadow-xl flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold">README</h2>
            <span className="text-xs text-muted-foreground">{fullName}</span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`${htmlUrl}#readme`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="在 GitHub 查看"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">加载 README...</span>
            </div>
          )}

          {error && !loading && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {content && !loading && (
            <div className="readme-markdown prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  img: ({ src, alt, ...props }) => (
                    <img
                      src={resolveGitHubUrl(src, fullName)}
                      alt={alt || ""}
                      loading="lazy"
                      className="max-w-full h-auto"
                      {...props}
                    />
                  ),
                  a: ({ href, children, ...props }) => (
                    <a
                      href={href?.startsWith("http") ? href : `https://github.com/${fullName}/blob/HEAD/${href?.replace(/^\.\//, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
