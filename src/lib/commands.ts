import { invoke } from "@tauri-apps/api/core";

// ===== 类型定义 =====

export interface Repo {
  id: number;
  github_id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  owner_login: string;
  owner_avatar_url: string | null;
  topics: string[];
  starred_at: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface RepoFilter {
  language?: string | null;
  tag_id?: number | null;
  search?: string | null;
  sort_by?: string | null;
  sort_order?: string | null;
  page: number;
  page_size: number;
}

export interface SyncResult {
  new_repos: number;
  total_repos: number;
}

export interface LangCount {
  language: string;
  count: number;
}

export interface SyncProgress {
  current_page: number;
  total_fetched: number;
  status: string;
}

// ===== 仓库相关 =====

export async function getRepos(filter: RepoFilter): Promise<Repo[]> {
  return invoke("get_repos", { filter });
}

export async function searchRepos(query: string): Promise<Repo[]> {
  return invoke("search_repos", { query });
}

export async function getRepoCountByLanguage(): Promise<LangCount[]> {
  return invoke("get_repo_count_by_language");
}

export async function getTotalRepoCount(): Promise<number> {
  return invoke("get_total_repo_count");
}

// ===== 标签相关 =====

export async function getTags(): Promise<Tag[]> {
  return invoke("get_tags");
}

export async function createTag(name: string, color: string): Promise<Tag> {
  return invoke("create_tag", { name, color });
}

export async function updateTag(id: number, name: string, color: string): Promise<Tag> {
  return invoke("update_tag", { id, name, color });
}

export async function deleteTag(id: number): Promise<void> {
  return invoke("delete_tag", { id });
}

export async function addTagToRepo(repoId: number, tagId: number): Promise<void> {
  return invoke("add_tag_to_repo", { repoId, tagId });
}

export async function removeTagFromRepo(repoId: number, tagId: number): Promise<void> {
  return invoke("remove_tag_from_repo", { repoId, tagId });
}

// ===== 同步相关 =====

export async function syncStars(token: string): Promise<SyncResult> {
  return invoke("sync_stars", { token });
}

// ===== 设置相关 =====

export async function getToken(): Promise<string | null> {
  return invoke("get_token");
}

export async function saveToken(token: string): Promise<void> {
  return invoke("save_token", { token });
}

export async function getLastSyncTime(): Promise<string | null> {
  return invoke("get_last_sync_time");
}

// ===== AI 相关 =====

export interface AiConfig {
  api_url: string | null;
  api_key: string | null;
  model: string | null;
}

export interface SummaryResult {
  summary: string;
  suggested_tags: string[];
  source: string; // "readme" | "readme+code" | "code"
}

export async function summarizeRepo(fullName: string): Promise<SummaryResult> {
  return invoke("summarize_repo", { fullName });
}

export async function getCachedSummary(fullName: string): Promise<SummaryResult | null> {
  return invoke("get_cached_summary", { fullName });
}

export async function aiAutoTag(repoId: number, fullName: string): Promise<string[]> {
  return invoke("ai_auto_tag", { repoId, fullName });
}

export async function getAiConfig(): Promise<AiConfig> {
  return invoke("get_ai_config");
}

export async function saveAiConfig(apiUrl: string, apiKey: string, model: string): Promise<void> {
  return invoke("save_ai_config", { apiUrl, apiKey, model });
}

export interface ModelInfo {
  id: string;
  owned_by: string;
}

export async function fetchModels(apiUrl: string, apiKey: string): Promise<ModelInfo[]> {
  return invoke("fetch_models", { apiUrl, apiKey });
}

// ===== OAuth 相关 =====

export interface OAuthConfig {
  client_id: string | null;
  client_secret: string | null;
}

export interface OAuthUrl {
  auth_url: string;
  port: number;
}

export async function saveOAuthConfig(clientId: string, clientSecret: string): Promise<void> {
  return invoke("save_oauth_config", { clientId, clientSecret });
}

export async function getOAuthConfig(): Promise<OAuthConfig> {
  return invoke("get_oauth_config");
}

export async function startOAuth(): Promise<OAuthUrl> {
  return invoke("start_oauth");
}

export async function waitOAuthCallback(port: number): Promise<string> {
  return invoke("wait_oauth_callback", { port });
}

// ===== 笔记相关 =====

export interface Note {
  id: number;
  repo_id: number;
  content: string;
  updated_at: string;
}

export async function getNote(repoId: number): Promise<Note | null> {
  return invoke("get_note", { repoId });
}

export async function saveNote(repoId: number, content: string): Promise<void> {
  return invoke("save_note", { repoId, content });
}

export async function getReposWithNotes(): Promise<number[]> {
  return invoke("get_repos_with_notes");
}

// ===== 统计相关 =====

export interface StatsOverview {
  total_repos: number;
  total_tags: number;
  total_languages: number;
  total_with_notes: number;
  avg_stars: number;
  max_stars_repo: string | null;
}

export interface TagCount {
  name: string;
  color: string;
  count: number;
}

export interface StarsBucket {
  label: string;
  count: number;
}

export interface MonthlyCount {
  month: string;
  count: number;
}

export async function getStatsOverview(): Promise<StatsOverview> {
  return invoke("get_stats_overview");
}

export async function getTagDistribution(): Promise<TagCount[]> {
  return invoke("get_tag_distribution");
}

export async function getStarsHistogram(): Promise<StarsBucket[]> {
  return invoke("get_stars_histogram");
}

export async function getMonthlyStarred(): Promise<MonthlyCount[]> {
  return invoke("get_monthly_starred");
}
