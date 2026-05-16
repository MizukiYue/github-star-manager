import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import {
  getRepos,
  searchRepos,
  getRepoCountByLanguage,
  getTotalRepoCount,
} from "@/lib/commands";

/**
 * 仓库数据操作 hook。
 * 不再内部自动 fetch，由调用方显式触发 refresh / refreshLanguages。
 */
export function useRepos() {
  const {
    repos,
    totalCount,
    loading,
    currentPage,
    pageSize,
    selectedLanguage,
    selectedTagId,
    searchQuery,
    sortBy,
    sortOrder,
    setRepos,
    setTotalCount,
    setLoading,
    setCurrentPage,
    setLanguages,
  } = useAppStore();

  const fetchRepos = useCallback(async () => {
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
      console.error("Failed to fetch repos:", err);
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    selectedLanguage,
    selectedTagId,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
    setRepos,
    setTotalCount,
    setLoading,
  ]);

  const fetchLanguages = useCallback(async () => {
    try {
      const langs = await getRepoCountByLanguage();
      setLanguages(langs);
    } catch (err) {
      console.error("Failed to fetch languages:", err);
    }
  }, [setLanguages]);

  return {
    repos,
    totalCount,
    loading,
    currentPage,
    pageSize,
    setCurrentPage,
    refresh: fetchRepos,
    refreshLanguages: fetchLanguages,
  };
}
