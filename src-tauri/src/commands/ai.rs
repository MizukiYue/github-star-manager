use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::repos::DbState;

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
}

#[derive(Debug, Deserialize)]
struct ChatMessageResponse {
    content: String,
}

// ===== GitHub 数据获取 =====

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

/// 从 GitHub 获取仓库的 README 内容
async fn fetch_readme(full_name: &str, github_token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/repos/{}/readme", full_name);

    let response = client
        .get(&url)
        .headers(github_headers(github_token)?)
        .send()
        .await
        .map_err(|e| format!("请求 README 失败: {}", e))?;

    if !response.status().is_success() {
        return Err("no_readme".to_string());
    }

    let content = response
        .text()
        .await
        .map_err(|e| format!("读取 README 内容失败: {}", e))?;

    Ok(content)
}

/// 获取仓库文件树（顶层 + 关键子目录）
async fn fetch_repo_tree(full_name: &str, github_token: &str) -> Result<Vec<TreeItem>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.github.com/repos/{}/git/trees/HEAD?recursive=1",
        full_name
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", github_token)).map_err(|e| e.to_string())?,
    );
    headers.insert("User-Agent", HeaderValue::from_static("github-star-manager"));
    headers.insert(
        "Accept",
        HeaderValue::from_static("application/vnd.github+json"),
    );

    let response = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("请求文件树失败: {}", e))?;

    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    let tree_resp: TreeResponse = response
        .json()
        .await
        .map_err(|e| format!("解析文件树失败: {}", e))?;

    Ok(tree_resp.tree)
}

#[derive(Debug, Deserialize)]
struct TreeResponse {
    tree: Vec<TreeItem>,
}

#[derive(Debug, Deserialize, Clone)]
struct TreeItem {
    path: String,
    #[serde(rename = "type")]
    item_type: String,
}

/// 获取单个文件内容
async fn fetch_file_content(
    full_name: &str,
    path: &str,
    github_token: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.github.com/repos/{}/contents/{}",
        full_name, path
    );

    let response = client
        .get(&url)
        .headers(github_headers(github_token)?)
        .send()
        .await
        .map_err(|e| format!("请求文件失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("获取文件 {} 失败", path));
    }

    let content = response
        .text()
        .await
        .map_err(|e| format!("读取文件内容失败: {}", e))?;

    // 截断单个文件，避免过大
    Ok(if content.len() > 5000 {
        content[..5000].to_string()
    } else {
        content
    })
}

/// 判断 README 是否信息充分（简单启发式）
fn is_readme_sufficient(readme: &str) -> bool {
    // README 少于 200 字符或少于 5 行认为信息不足
    let line_count = readme.lines().count();
    let char_count = readme.chars().count();
    char_count > 200 && line_count > 5
}

/// 选择关键代码文件用于补充分析
fn pick_key_files(tree: &[TreeItem]) -> Vec<String> {
    // 优先级：配置文件 > 入口文件 > 核心源码
    let priority_patterns: &[&str] = &[
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "setup.py",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "Makefile",
        "docker-compose.yml",
        "Dockerfile",
    ];

    let entry_patterns: &[&str] = &[
        "main.rs",
        "lib.rs",
        "main.go",
        "main.py",
        "app.py",
        "index.ts",
        "index.js",
        "App.tsx",
        "App.vue",
        "main.tsx",
    ];

    let mut selected: Vec<String> = Vec::new();

    // 先选配置文件
    for pattern in priority_patterns {
        for item in tree {
            if item.item_type == "blob" && item.path.ends_with(pattern) && item.path.matches('/').count() <= 1 {
                selected.push(item.path.clone());
                break;
            }
        }
        if selected.len() >= 3 {
            break;
        }
    }

    // 再选入口文件
    for pattern in entry_patterns {
        if selected.len() >= 5 {
            break;
        }
        for item in tree {
            if item.item_type == "blob"
                && item.path.ends_with(pattern)
                && !selected.contains(&item.path)
            {
                selected.push(item.path.clone());
                break;
            }
        }
    }

    selected
}

/// 构建文件树摘要字符串
fn summarize_tree(tree: &[TreeItem]) -> String {
    let files: Vec<&str> = tree
        .iter()
        .filter(|t| t.item_type == "blob")
        .map(|t| t.path.as_str())
        .take(80) // 最多展示 80 个文件
        .collect();

    files.join("\n")
}

// ===== AI API 调用 =====

fn build_endpoint(api_url: &str) -> String {
    if api_url.ends_with("/chat/completions") {
        api_url.to_string()
    } else if api_url.ends_with('/') {
        format!("{}chat/completions", api_url)
    } else {
        format!("{}/chat/completions", api_url)
    }
}

async fn call_ai(
    api_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request_body = ChatRequest {
        model: model.to_string(),
        messages,
        max_tokens,
        temperature: 0.3,
    };

    let endpoint = build_endpoint(api_url);

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key)).map_err(|e| e.to_string())?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let response = client
        .post(&endpoint)
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("AI API 请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("AI API 错误 ({}): {}", status, body));
    }

    let chat_response: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("解析 AI 响应失败: {}", e))?;

    chat_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .ok_or_else(|| "AI 未返回有效响应".to_string())
}

// ===== 对外命令 =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryResult {
    pub summary: String,
    pub suggested_tags: Vec<String>,
    pub source: String, // "readme" | "readme+code" | "code"
}

#[tauri::command]
pub async fn summarize_repo(
    state: State<'_, DbState>,
    full_name: String,
) -> Result<SummaryResult, String> {
    // 从数据库读取配置
    let (github_token, ai_api_url, ai_api_key, ai_model, existing_tags) = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;

        let github_token: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'github_token'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "请先配置 GitHub Token".to_string())?;

        let ai_api_url: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'ai_api_url'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "请先配置 AI API 地址".to_string())?;

        let ai_api_key: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'ai_api_key'",
                [],
                |row| row.get(0),
            )
            .map_err(|_| "请先配置 AI API Key".to_string())?;

        let ai_model: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'ai_model'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "gpt-3.5-turbo".to_string());

        // 获取已有标签列表
        let mut stmt = conn
            .prepare("SELECT name FROM tags ORDER BY name")
            .map_err(|e| e.to_string())?;
        let tags: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        (github_token, ai_api_url, ai_api_key, ai_model, tags)
    };

    // 第一步：获取 README
    let readme = fetch_readme(&full_name, &github_token).await.ok();
    let readme_sufficient = readme.as_ref().map_or(false, |r| is_readme_sufficient(r));

    // 第二步：如果 README 不充分，获取代码文件补充
    let mut code_context = String::new();
    let source;

    if !readme_sufficient {
        // 获取文件树
        let tree = fetch_repo_tree(&full_name, &github_token).await.unwrap_or_default();

        if !tree.is_empty() {
            // 添加文件树摘要
            code_context.push_str("=== 项目文件结构 ===\n");
            code_context.push_str(&summarize_tree(&tree));
            code_context.push_str("\n\n");

            // 读取关键文件
            let key_files = pick_key_files(&tree);
            for file_path in &key_files {
                if let Ok(content) = fetch_file_content(&full_name, file_path, &github_token).await
                {
                    code_context.push_str(&format!("=== {} ===\n", file_path));
                    code_context.push_str(&content);
                    code_context.push_str("\n\n");
                }
            }
        }

        source = if readme.is_some() {
            "readme+code".to_string()
        } else {
            "code".to_string()
        };
    } else {
        source = "readme".to_string();
    }

    // 第三步：构建 AI prompt
    let mut user_content = String::new();

    if let Some(ref readme_text) = readme {
        let truncated = if readme_text.len() > 12000 {
            &readme_text[..12000]
        } else {
            readme_text.as_str()
        };
        user_content.push_str("=== README.md ===\n");
        user_content.push_str(truncated);
        user_content.push_str("\n\n");
    }

    if !code_context.is_empty() {
        let truncated = if code_context.len() > 10000 {
            &code_context[..10000]
        } else {
            code_context.as_str()
        };
        user_content.push_str(truncated);
    }

    // 构建标签提示
    let tags_hint = if existing_tags.is_empty() {
        "用户目前没有已创建的标签。请根据项目特征建议 1-3 个通用的分类标签（如：工具库、Web框架、机器学习、CLI工具、数据库、DevOps 等），标签名称应具有较好的复用性，避免过于具体。".to_string()
    } else {
        format!(
            "用户已有的标签：[{}]。\n\
            重要：你必须优先从已有标签中选择，只要项目与某个已有标签存在合理关联就应该使用它。\n\
            只有当已有标签中确实没有任何一个能描述该项目时，才可以建议一个新标签。\n\
            新标签的命名应通用、可复用，避免为单个项目创建过于具体的标签。\n\
            总共建议 1-3 个标签。",
            existing_tags.join(", ")
        )
    };

    let system_prompt = format!(
        "你是一个技术项目分析助手。请根据提供的项目信息完成两个任务：\n\
        \n\
        任务一：用中文详细分析该项目，使用 Markdown 格式输出，包含以下内容：\n\
        - **项目简介**：一句话说明项目是什么、解决什么问题\n\
        - **核心功能**：列出主要功能点（每个功能用一行简要描述）\n\
        - **技术栈**：列出使用的编程语言、框架、关键依赖库\n\
        - **适用场景**：说明该项目适合在什么场景下使用\n\
        - **亮点特色**：如果有独特的设计、性能优势或创新点，列出来\n\
        尽可能保留有价值的信息，不要过度压缩。\n\
        \n\
        任务二：为该项目建议分类标签。{}\n\
        \n\
        请严格按以下格式输出（不要添加其他内容）：\n\
        \n\
        ## 总结\n\
        （你的 Markdown 格式分析内容）\n\
        \n\
        ## 标签\n\
        标签1, 标签2, 标签3",
        tags_hint
    );

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
        },
        ChatMessage {
            role: "user".to_string(),
            content: format!("请分析以下项目：{}\n\n{}", full_name, user_content),
        },
    ];

    let ai_response = call_ai(&ai_api_url, &ai_api_key, &ai_model, messages, 1500).await?;

    // 第四步：解析 AI 响应
    let (summary, suggested_tags) = parse_ai_response(&ai_response);

    let result = SummaryResult {
        summary,
        suggested_tags,
        source,
    };

    // 缓存结果
    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let cached_json = serde_json::to_string(&result).unwrap_or_default();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![format!("summary:{}", full_name), cached_json],
        )
        .ok();
    }

    Ok(result)
}

/// 解析 AI 响应，提取总结和标签
fn parse_ai_response(response: &str) -> (String, Vec<String>) {
    // 尝试按 ## 标签 分割
    if let Some(tag_pos) = response.find("## 标签") {
        let summary_part = &response[..tag_pos];
        let tag_part = &response[tag_pos..];

        // 提取总结（去掉 ## 总结 标题）
        let summary = summary_part
            .replace("## 总结", "")
            .trim()
            .to_string();

        // 提取标签
        let tag_line = tag_part.replace("## 标签", "").trim().to_string();
        let tags: Vec<String> = tag_line
            .split(|c| c == ',' || c == '、' || c == '，')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && s.len() < 20)
            .collect();

        (summary, tags)
    } else {
        // 无法解析格式，整体作为总结
        (response.trim().to_string(), Vec::new())
    }
}

#[tauri::command]
pub fn get_cached_summary(
    state: State<DbState>,
    full_name: String,
) -> Result<Option<SummaryResult>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [format!("summary:{}", full_name)],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(json_str) => {
            // 尝试解析为新格式
            if let Ok(parsed) = serde_json::from_str::<SummaryResult>(&json_str) {
                Ok(Some(parsed))
            } else {
                // 兼容旧格式（纯文本）
                Ok(Some(SummaryResult {
                    summary: json_str,
                    suggested_tags: Vec::new(),
                    source: "readme".to_string(),
                }))
            }
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// AI 自动打标签：分析仓库并应用建议的标签
#[tauri::command]
pub async fn ai_auto_tag(
    state: State<'_, DbState>,
    repo_id: i64,
    full_name: String,
) -> Result<Vec<String>, String> {
    // 先调用 summarize_repo 获取建议标签
    let result = summarize_repo(state.clone(), full_name).await?;

    if result.suggested_tags.is_empty() {
        return Ok(Vec::new());
    }

    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut applied_tags: Vec<String> = Vec::new();

    for tag_name in &result.suggested_tags {
        // 查找或创建标签
        let tag_id: i64 = match conn.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            [tag_name],
            |row| row.get(0),
        ) {
            Ok(id) => id,
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // 创建新标签（使用随机颜色）
                let colors = [
                    "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
                    "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#64748b",
                ];
                let color = colors[tag_name.len() % colors.len()];
                conn.execute(
                    "INSERT INTO tags (name, color) VALUES (?1, ?2)",
                    rusqlite::params![tag_name, color],
                )
                .map_err(|e| e.to_string())?;
                conn.last_insert_rowid()
            }
            Err(e) => return Err(e.to_string()),
        };

        // 关联标签到仓库
        conn.execute(
            "INSERT OR IGNORE INTO repo_tags (repo_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![repo_id, tag_id],
        )
        .map_err(|e| e.to_string())?;

        applied_tags.push(tag_name.clone());
    }

    Ok(applied_tags)
}

// ===== AI 设置相关 =====

#[tauri::command]
pub fn get_ai_config(state: State<DbState>) -> Result<AiConfig, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let get_setting = |key: &str| -> Option<String> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .ok()
    };

    Ok(AiConfig {
        api_url: get_setting("ai_api_url"),
        api_key: get_setting("ai_api_key"),
        model: get_setting("ai_model"),
    })
}

#[tauri::command]
pub fn save_ai_config(
    state: State<DbState>,
    api_url: String,
    api_key: String,
    model: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_api_url', ?1)",
        [&api_url],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_api_key', ?1)",
        [&api_key],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_model', ?1)",
        [&model],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

// ===== 拉取可用模型 =====

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    data: Vec<ModelInfo>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ModelInfo {
    pub id: String,
    #[serde(default)]
    pub owned_by: String,
}

#[tauri::command]
pub async fn fetch_models(api_url: String, api_key: String) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();

    let base = api_url.trim_end_matches('/');
    let endpoint = if base.ends_with("/models") {
        base.to_string()
    } else if base.ends_with("/chat/completions") {
        base.replace("/chat/completions", "/models")
    } else {
        format!("{}/models", base)
    };

    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key)).map_err(|e| e.to_string())?,
    );

    let response = client
        .get(&endpoint)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("请求模型列表失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("获取模型列表失败 ({}): {}", status, body));
    }

    let models_resp: ModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("解析模型列表失败: {}", e))?;

    let mut models = models_resp.data;
    models.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(models)
}
