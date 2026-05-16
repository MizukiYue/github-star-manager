import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { RepoList } from "@/components/RepoList";
import { SearchBar } from "@/components/SearchBar";
import { Settings } from "@/components/Settings";
import { Dashboard } from "@/components/Dashboard";
import { useAppStore } from "@/stores/appStore";
import { useSync } from "@/hooks/useSync";
import { useRepos } from "@/hooks/useRepos";
import { useTags } from "@/hooks/useTags";
import { getToken } from "@/lib/commands";

function App() {
  const {
    showSettings,
    showDashboard,
    selectedLanguage,
    selectedTagId,
    searchQuery,
    sortBy,
    sortOrder,
    currentPage,
    setToken,
    setShowSettings,
  } = useAppStore();

  const { fetchLastSyncTime } = useSync();
  const { refresh, refreshLanguages } = useRepos();
  const { refresh: refreshTags } = useTags();

  // 初始化：加载 token、标签、仓库
  useEffect(() => {
    const init = async () => {
      try {
        const token = await getToken();
        setToken(token);
        await fetchLastSyncTime();
        await refreshTags();
        await refreshLanguages();
        await refresh();

        if (!token) {
          setShowSettings(true);
        }
      } catch (err) {
        console.error("Init failed:", err);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 筛选条件变化时重新加载仓库
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, selectedTagId, searchQuery, sortBy, sortOrder, currentPage]);

  const renderContent = () => {
    if (showSettings) return <Settings />;
    if (showDashboard) return <Dashboard />;
    return <RepoList />;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {!showDashboard && <SearchBar />}
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
