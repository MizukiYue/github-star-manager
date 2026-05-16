import { useState } from "react";
import { useTags } from "@/hooks/useTags";
import { Tag as TagIcon, Plus, Trash2, X, ChevronRight } from "lucide-react";
import { cn, buildTagTree, TagTreeNode } from "@/lib/utils";

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
  const [parentPrefix, setParentPrefix] = useState("");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const uniqueParents = Array.from(new Set(tags.map((t) => {
    const parts = t.name.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : t.name;
  }))).sort();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const fullName = parentPrefix ? `${parentPrefix}/${newName.trim()}` : newName.trim();
    try {
      await createTag(fullName, newColor);
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

  const tagTree = buildTagTree(tags);

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
          {/* 父标签选择 */}
          <div className="flex items-center gap-2">
            <select
              value={parentPrefix}
              onChange={(e) => setParentPrefix(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">顶级标签</option>
              {uniqueParents.map((name) => (
                <option key={name} value={name}>
                  {name}/
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={parentPrefix ? `在 ${parentPrefix}/ 下创建...` : "输入标签名称..."}
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
          {parentPrefix && newName.trim() && (
            <p className="text-xs text-muted-foreground">
              将创建: <span className="font-medium text-foreground">{parentPrefix}/{newName.trim()}</span>
            </p>
          )}
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

        {/* 标签列表（树形） */}
        <div className="p-4 max-h-64 overflow-y-auto">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              暂无标签，创建一个吧
            </p>
          ) : (
            <div className="space-y-0.5">
              {tagTree.map((node) => (
                <TagTreeManagerItem
                  key={node.tag.id}
                  node={node}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagTreeManagerItem({
  node,
  onDelete,
}: {
  node: TagTreeNode;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent transition-colors group"
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      >
        <span className="flex items-center gap-2 text-sm min-w-0">
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="p-0.5">
              <ChevronRight
                className={cn("w-3 h-3 text-muted-foreground transition-transform", expanded && "rotate-90")}
              />
            </button>
          ) : (
            <span className="w-4" />
          )}
          <TagIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: node.tag.color }} />
          <span className="truncate">{node.displayName}</span>
        </span>
        <button
          onClick={() => onDelete(node.tag.id)}
          className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TagTreeManagerItem key={child.tag.id} node={child} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
