import { create } from "zustand";
import { Repo, Tag, LangCount } from "@/lib/commands";

interface AppState {
  // 仓库
  repos: Repo[];
  totalCount: number;
  loading: boolean;
  currentPage: number;
  pageSize: number;

  // 筛选
  selectedLanguage: string | null;
  selectedTagId: number | null;
  searchQuery: string;
  sortBy: string;
  sortOrder: string; // "desc" | "asc"

  // 标签
  tags: Tag[];

  // 语言统计
  languages: LangCount[];

  // 同步
  syncing: boolean;
  syncProgress: string;
  lastSyncTime: string | null;

  // 设置
  showSettings: boolean;
  showDashboard: boolean;
  token: string | null;

  // 主题
  darkMode: boolean;

  // Actions
  setRepos: (repos: Repo[]) => void;
  setTotalCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  setCurrentPage: (page: number) => void;
  setSelectedLanguage: (lang: string | null) => void;
  setSelectedTagId: (tagId: number | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: string) => void;
  setSortOrder: (sortOrder: string) => void;
  toggleSortOrder: () => void;
  setTags: (tags: Tag[]) => void;
  setLanguages: (languages: LangCount[]) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncProgress: (progress: string) => void;
  setLastSyncTime: (time: string | null) => void;
  setShowSettings: (show: boolean) => void;
  setShowDashboard: (show: boolean) => void;
  setToken: (token: string | null) => void;
  toggleDarkMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  repos: [],
  totalCount: 0,
  loading: false,
  currentPage: 1,
  pageSize: 30,

  selectedLanguage: null,
  selectedTagId: null,
  searchQuery: "",
  sortBy: "starred",
  sortOrder: "desc",

  tags: [],
  languages: [],

  syncing: false,
  syncProgress: "",
  lastSyncTime: null,

  showSettings: false,
  showDashboard: false,
  token: null,

  darkMode: false,

  setRepos: (repos) => set({ repos }),
  setTotalCount: (totalCount) => set({ totalCount }),
  setLoading: (loading) => set({ loading }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setSelectedLanguage: (selectedLanguage) => set({ selectedLanguage, currentPage: 1 }),
  setSelectedTagId: (selectedTagId) => set({ selectedTagId, currentPage: 1 }),
  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
  setSortBy: (sortBy) => set({ sortBy, currentPage: 1 }),
  setSortOrder: (sortOrder) => set({ sortOrder, currentPage: 1 }),
  toggleSortOrder: () =>
    set((state) => ({
      sortOrder: state.sortOrder === "desc" ? "asc" : "desc",
      currentPage: 1,
    })),
  setTags: (tags) => set({ tags }),
  setLanguages: (languages) => set({ languages }),
  setSyncing: (syncing) => set({ syncing }),
  setSyncProgress: (syncProgress) => set({ syncProgress }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setShowSettings: (showSettings) => set({ showSettings, showDashboard: false }),
  setShowDashboard: (showDashboard) => set({ showDashboard, showSettings: false }),
  setToken: (token) => set({ token }),
  toggleDarkMode: () =>
    set((state) => {
      const newMode = !state.darkMode;
      if (newMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return { darkMode: newMode };
    }),
}));
