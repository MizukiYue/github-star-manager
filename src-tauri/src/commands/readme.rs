use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use tauri::State;

use crate::commands::repos::DbState;

fn github_headers(token: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", token)).map_err(|e| e.to_string())?,
    );
    headers.insert(
        "Accept",
        HeaderValue::from_static("application/vnd.github.raw+json"),
    );
    headers.insert(
        "User-Agent",
        HeaderValue::from_static("github-star-manager"),
    );
    Ok(headers)
}

#[tauri::command]
pub async fn fetch_repo_readme(
    state: State<'_, DbState>,
    full_name: String,
) -> Result<String, String> {
    // 先检查缓存
    let cache_key = format!("readme:{}", full_name);
    let (github_token, cached) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;

        let cached: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                [&cache_key],
                |row| row.get(0),
            )
            .ok();

        let github_token: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'github_token'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "请先配置 GitHub Token".to_string())?;

        (github_token, cached)
    };

    if let Some(content) = cached {
        return Ok(content);
    }

    // 从 GitHub 获取
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/repos/{}/readme", full_name);

    let response = client
        .get(&url)
        .headers(github_headers(&github_token)?)
        .send()
        .await
        .map_err(|e| format!("请求 README 失败: {}", e))?;

    if !response.status().is_success() {
        return Err("该仓库没有 README 文件".to_string());
    }

    let content = response
        .text()
        .await
        .map_err(|e| format!("读取 README 内容失败: {}", e))?;

    // 缓存（截断过大的 README 避免数据库膨胀）
    let to_cache = if content.len() > 200_000 {
        content[..200_000].to_string()
    } else {
        content.clone()
    };

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![cache_key, to_cache],
        )
        .ok();
    }

    Ok(content)
}
