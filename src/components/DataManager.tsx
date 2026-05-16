import { useState, useRef } from "react";
import { exportData, importData, ExportData, ImportResult } from "@/lib/commands";
import { Download, Upload, Loader2, Check, AlertCircle } from "lucide-react";

interface DataManagerProps {
  onImportDone?: () => void;
}

export function DataManager({ onImportDone }: DataManagerProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `star-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({
        type: "success",
        text: `导出成功：${data.tags.length} 个标签，${data.repos.length} 个仓库数据`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `导出失败：${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);

    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);

      if (!data.version || !data.tags || !data.repos) {
        throw new Error("文件格式无效");
      }

      const result: ImportResult = await importData(data);
      setMessage({
        type: "success",
        text: `导入成功：新增 ${result.tags_imported} 个标签，恢复 ${result.notes_imported} 条笔记，关联 ${result.tags_linked} 个标签`,
      });
      onImportDone?.();
    } catch (err) {
      setMessage({
        type: "error",
        text: `导入失败：${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">数据管理</h3>
      <p className="text-xs text-muted-foreground">
        导出标签和笔记为 JSON 文件，或从备份文件恢复。导入不会覆盖已有数据。
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {exporting ? "导出中..." : "导出数据"}
        </button>

        <button
          onClick={handleImportClick}
          disabled={importing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-input bg-background hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {importing ? "导入中..." : "导入数据"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-md text-xs ${
            message.type === "success"
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
