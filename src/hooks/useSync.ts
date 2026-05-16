import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { syncStars, getLastSyncTime } from "@/lib/commands";

export function useSync() {
  const {
    syncing,
    syncProgress,
    lastSyncTime,
    token,
    setSyncing,
    setSyncProgress,
    setLastSyncTime,
  } = useAppStore();

  const fetchLastSyncTime = useCallback(async () => {
    try {
      const time = await getLastSyncTime();
      setLastSyncTime(time);
    } catch (err) {
      console.error("Failed to get last sync time:", err);
    }
  }, [setLastSyncTime]);

  const handleSync = useCallback(async () => {
    if (!token) {
      throw new Error("请先配置 GitHub Token");
    }

    setSyncing(true);
    setSyncProgress("正在同步...");

    try {
      const result = await syncStars(token);
      setSyncProgress(
        `同步完成！新增 ${result.new_repos} 个仓库，共 ${result.total_repos} 个`
      );
      await fetchLastSyncTime();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncProgress(`同步失败: ${message}`);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [token, setSyncing, setSyncProgress, fetchLastSyncTime]);

  return {
    syncing,
    syncProgress,
    lastSyncTime,
    sync: handleSync,
    fetchLastSyncTime,
  };
}
