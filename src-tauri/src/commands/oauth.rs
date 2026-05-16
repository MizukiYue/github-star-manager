use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::commands::repos::DbState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OAuthUrl {
    pub auth_url: String,
    pub port: u16,
}

/// 保存 OAuth 配置
#[tauri::command]
pub fn save_oauth_config(
    state: State<DbState>,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('oauth_client_id', ?1)",
        [&client_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('oauth_client_secret', ?1)",
        [&client_secret],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取 OAuth 配置
#[tauri::command]
pub fn get_oauth_config(state: State<DbState>) -> Result<OAuthConfig, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let get = |key: &str| -> Option<String> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .ok()
    };

    Ok(OAuthConfig {
        client_id: get("oauth_client_id"),
        client_secret: get("oauth_client_secret"),
    })
}

/// 启动 OAuth 流程：绑定随机端口，返回授权 URL 和端口号
#[tauri::command]
pub async fn start_oauth(state: State<'_, DbState>) -> Result<OAuthUrl, String> {
    let client_id = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;

        conn.query_row(
            "SELECT value FROM settings WHERE key = 'oauth_client_id'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| "请先配置 OAuth Client ID".to_string())?
    };

    // 绑定随机端口，获取端口号后立即释放
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("无法启动本地服务器: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    // 释放端口，wait_oauth_callback 会重新绑定
    drop(listener);

    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
    let auth_url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=read:user",
        client_id,
        urlencoding::encode(&redirect_uri)
    );

    Ok(OAuthUrl { auth_url, port })
}

/// 等待 OAuth 回调并交换 token
#[tauri::command]
pub async fn wait_oauth_callback(
    state: State<'_, DbState>,
    port: u16,
) -> Result<String, String> {
    let (client_id, client_secret) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;

        let client_id: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'oauth_client_id'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "OAuth 配置缺失".to_string())?;

        let client_secret: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'oauth_client_secret'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "OAuth 配置缺失".to_string())?;

        (client_id, client_secret)
    };

    // 绑定端口等待回调
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| format!("无法绑定端口 {}: {}", port, e))?;

    // 等待连接（超时 120 秒）
    let (mut stream, _) = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        listener.accept(),
    )
    .await
    .map_err(|_| "OAuth 登录超时（120秒），请重试".to_string())?
    .map_err(|e| format!("接受连接失败: {}", e))?;

    // 读取 HTTP 请求
    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("读取请求失败: {}", e))?;

    let request = String::from_utf8_lossy(&buf[..n]);

    // 解析 code 参数
    let code = extract_code_from_request(&request)
        .ok_or_else(|| "未能从回调中获取授权码".to_string())?;

    // 返回成功页面给浏览器
    let success_html = r#"<!DOCTYPE html><html><head><meta charset="utf-8"><title>授权成功</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc}
.card{text-align:center;padding:2rem;border-radius:12px;background:white;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
h1{color:#22c55e;margin-bottom:0.5rem}p{color:#64748b}</style></head>
<body><div class="card"><h1>&#10003; 授权成功</h1><p>已获取 GitHub 授权，可以关闭此页面返回应用。</p></div></body></html>"#;

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        success_html.len(),
        success_html
    );

    stream.write_all(response.as_bytes()).await.ok();
    stream.flush().await.ok();
    drop(stream);
    drop(listener);

    // 用 code 交换 access_token
    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
    let token = exchange_code_for_token(&client_id, &client_secret, &code, &redirect_uri).await?;

    // 保存 token 到数据库
    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('github_token', ?1)",
            [&token],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(token)
}

/// 从 HTTP 请求中提取 code 参数
fn extract_code_from_request(request: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;

    if let Some(query_start) = path.find('?') {
        let query = &path[query_start + 1..];
        for param in query.split('&') {
            if let Some(value) = param.strip_prefix("code=") {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// 用授权码交换 access_token
async fn exchange_code_for_token(
    client_id: &str,
    client_secret: &str,
    code: &str,
    redirect_uri: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let body = serde_json::json!({
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    });

    let response = client
        .post("https://github.com/login/oauth/access_token")
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求 token 失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("GitHub 返回错误 ({}): {}", status, text));
    }

    let token_resp: TokenResponse = response
        .json()
        .await
        .map_err(|e| format!("解析 token 响应失败: {}", e))?;

    if let Some(token) = token_resp.access_token {
        Ok(token)
    } else {
        let err = token_resp
            .error_description
            .or(token_resp.error)
            .unwrap_or_else(|| "未知错误".to_string());
        Err(format!("获取 token 失败: {}", err))
    }
}
