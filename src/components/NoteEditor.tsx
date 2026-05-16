import { useState, useEffect, useRef } from "react";
import { getNote, saveNote } from "@/lib/commands";
import { Loader2, Check } from "lucide-react";

interface NoteEditorProps {
  repoId: number;
  open: boolean;
  onClose: () => void;
}

export function NoteEditor({ repoId, open, onClose }: NoteEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaved(false);
    getNote(repoId)
      .then((note) => {
        setContent(note?.content || "");
      })
      .catch(() => {
        setContent("");
      })
      .finally(() => {
        setLoading(false);
        // 聚焦
        setTimeout(() => textareaRef.current?.focus(), 50);
      });
  }, [open, repoId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveNote(repoId, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    setSaved(false);
    // 防抖自动保存（1.5 秒无输入后保存）
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNote(repoId, value).then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      });
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      handleSave();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          加载笔记...
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="写点笔记...（Ctrl+Enter 保存，Esc 关闭）"
            className="w-full min-h-[80px] max-h-[200px] px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {content.length > 0 ? `${content.length} 字` : ""}
            </span>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3 h-3" />
                  已保存
                </span>
              )}
              {saving && (
                <span className="text-xs text-muted-foreground">保存中...</span>
              )}
              <button
                onClick={() => { handleSave(); onClose(); }}
                className="px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
