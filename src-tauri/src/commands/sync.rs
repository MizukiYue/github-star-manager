use tauri::State;

use crate::commands::repos::DbState;
use crate::github::GitHubClient;
use crate::models::SyncResult;

#[tauri::command]
pub async fn sync_stars(state: State<'_, DbState>, token: String) -> Result<SyncResult, String> {
    let client = GitHubClient::new(&token);

    // 第一步：网络请求（不持有数据库锁）
    let starred_repos = client.get_all_starred_repos().await?;

    // 第二步：短暂获取锁，用事务批量写入
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 获取写入前的总数，用于计算新增数量
    let count_before: i64 = conn
        .query_row("SELECT COUNT(*) FROM repositories", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // 使用事务批量插入（极大提升 SQLite 写入性能）
    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| e.to_string())?;

    for starred in &starred_repos {
        let repo = &starred.repo;
        let topics_json = serde_json::to_string(&repo.topics.as_deref().unwrap_or(&[]))
            .unwrap_or_else(|_| "[]".to_string());

        let result = conn.execute(
            "INSERT INTO repositories (github_id, name, full_name, description, html_url, \
             language, stargazers_count, owner_login, owner_avatar_url, topics, starred_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) \
             ON CONFLICT(github_id) DO UPDATE SET \
             name = excluded.name, \
             full_name = excluded.full_name, \
             description = excluded.description, \
             stargazers_count = excluded.stargazers_count, \
             language = excluded.language, \
             topics = excluded.topics, \
             updated_at = datetime('now')",
            rusqlite::params![
                repo.id,
                repo.name,
                repo.full_name,
                repo.description,
                repo.html_url,
                repo.language,
                repo.stargazers_count,
                repo.owner.login,
                repo.owner.avatar_url,
                topics_json,
                starred.starred_at,
            ],
        );

        if let Err(e) = result {
            eprintln!("Failed to insert repo {}: {}", repo.full_name, e);
        }
    }

    // 更新最后同步时间
    let _ = conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_time', datetime('now'))",
        [],
    );

    conn.execute_batch("COMMIT")
        .map_err(|e| e.to_string())?;

    // 计算新增数量
    let count_after: i64 = conn
        .query_row("SELECT COUNT(*) FROM repositories", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    Ok(SyncResult {
        new_repos: count_after - count_before,
        total_repos: count_after,
    })
}
