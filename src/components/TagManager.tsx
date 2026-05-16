import { useState } from "react";
import { useTags } from "@/hooks/useTags";
import { Tag as TagIcon, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#64748b", // slate
];

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
}

export function TagManager({ open, onClose }: TagManagerProps) {
  const { tags, createTag, deleteTag } = useTags();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createTag(newName.trim(), newColor);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
    } catch {
      // error logged in hook
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此标签？关联的仓库标签也会被移除。")) return;
    try {
      await deleteTag(id);
    } catch {
      // error logged in hook
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold">管理标签</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 创建新标签 */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="输入标签名称..."
              className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加
            </button>
          </div>
          {/* 颜色选择 */}
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  newColor === color
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* 标签列表 */}
        <div className="p-4 max-h-64 overflow-y-auto">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              暂无标签，创建一个吧
            </p>
          ) : (
            <div className="space-y-1">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <TagIcon
                      className="w-3.5 h-3.5"
                      style={{ color: tag.color }}
                    />
                    {tag.name}
                  </span>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
