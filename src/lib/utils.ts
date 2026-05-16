import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Tag } from "@/lib/commands";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TagTreeNode {
  tag: Tag;
  children: TagTreeNode[];
  depth: number;
  displayName: string; // 只显示最后一段，如 "React" 而非 "前端/React"
}

export function buildTagTree(tags: Tag[]): TagTreeNode[] {
  const roots: TagTreeNode[] = [];
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  for (const tag of sorted) {
    const parts = tag.name.split("/");
    const displayName = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");

    const node: TagTreeNode = { tag, children: [], depth: parts.length - 1, displayName };

    if (!parentPath) {
      roots.push(node);
    } else {
      const parent = findNodeByName(roots, parentPath);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

function findNodeByName(nodes: TagTreeNode[], name: string): TagTreeNode | null {
  for (const node of nodes) {
    if (node.tag.name === name) return node;
    const found = findNodeByName(node.children, name);
    if (found) return found;
  }
  return null;
}

export function flattenTagTree(nodes: TagTreeNode[]): TagTreeNode[] {
  const result: TagTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenTagTree(node.children));
    }
  }
  return result;
}

export function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toString();
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} 天前`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} 个月前`;
  return `${Math.floor(seconds / 31536000)} 年前`;
}
