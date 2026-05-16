use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

use crate::models::{LangCount, Repo, RepoFilter, Tag};

pub struct DbState(pub Mutex<Connection>);

/// 批量加载一组 repo 的 tags（避免 N+1 查询）
fn batch_load_tags(conn: &Connection, repo_ids: &[i64]) -> HashMap<i64, Vec<Tag>> {
    if repo_ids.is_empty() {
        return HashMap::new();
    }

    let placeholders: Vec<String> = repo_ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT rt.repo_id, t.id, t.name, t.color, t.created_at \
         FROM tags t \
         INNER JOIN repo_tags rt ON t.id = rt.tag_id \
         WHERE rt.repo_id IN ({}) \
         ORDER BY t.name",
        placeholders.join(",")
    );

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };

    let params: Vec<&dyn rusqlite::types::ToSql> =
        repo_ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();

    let mut map: HashMap<i64, Vec<Tag>> = HashMap::new();

    if let Ok(rows) = stmt.query_map(params.as_slice(), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            Tag {
                id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
            },
        ))
    }) {
        for row in rows.flatten() {
            map.entry(row.0).or_default().push(row.1);
        }
    }

    map
}

#[tauri::command]
pub fn get_repos(state: State<DbState>, filter: RepoFilter) -> Result<Vec<Repo>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from(
        "SELECT r.id, r.github_id, r.name, r.full_name, r.description, r.html_url, \
         r.language, r.stargazers_count, r.owner_login, r.owner_avatar_url, \
         r.topics, r.starred_at, r.created_at, r.updated_at \
         FROM repositories r",
    );

    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(tag_id) = filter.tag_id {
        sql.push_str(" INNER JOIN repo_tags rt ON r.id = rt.repo_id");
        conditions.push("rt.tag_id = ?".to_string());
        params.push(Box::new(tag_id));
    }

    if let Some(ref lang) = filter.language {
        conditions.push("r.language = ?".to_string());
        params.push(Box::new(lang.clone()));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }

    // 排序
    let dir = match filter.sort_order.as_deref() {
        Some("asc") => "ASC",
        _ => "DESC",
    };
    let order_clause = match filter.sort_by.as_deref() {
        Some("stars") => format!(" ORDER BY r.stargazers_count {}", dir),
        Some("updated") => format!(" ORDER BY r.updated_at {}", dir),
        _ => format!(" ORDER BY r.starred_at {} NULLS LAST", dir),
    };
    sql.push_str(&order_clause);

    let offset = (filter.page - 1) * filter.page_size;
    sql.push_str(&format!(" LIMIT {} OFFSET {}", filter.page_size, offset));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let repos = stmt
        .query_map(param_refs.as_slice(), |row| {
            let topics_str: String = row.get(10)?;
            let topics: Vec<String> =
                serde_json::from_str(&topics_str).unwrap_or_default();

            Ok(Repo {
                id: row.get(0)?,
                github_id: row.get(1)?,
                name: row.get(2)?,
                full_name: row.get(3)?,
                description: row.get(4)?,
                html_url: row.get(5)?,
                language: row.get(6)?,
                stargazers_count: row.get(7)?,
                owner_login: row.get(8)?,
                owner_avatar_url: row.get(9)?,
                topics,
                starred_at: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // 批量加载 tags
    let repo_ids: Vec<i64> = repos.iter().map(|r| r.id).collect();
    let mut tags_map = batch_load_tags(&conn, &repo_ids);

    let repos_with_tags = repos
        .into_iter()
        .map(|mut repo| {
            repo.tags = tags_map.remove(&repo.id).unwrap_or_default();
            repo
        })
        .collect();

    Ok(repos_with_tags)
}

#[tauri::command]
pub fn search_repos(state: State<DbState>, query: String) -> Result<Vec<Repo>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 使用 FTS5 搜索
    let fts_query = query
        .split_whitespace()
        .map(|w| format!("\"{}\"*", w))
        .collect::<Vec<_>>()
        .join(" OR ");

    let sql = "SELECT r.id, r.github_id, r.name, r.full_name, r.description, r.html_url, \
               r.language, r.stargazers_count, r.owner_login, r.owner_avatar_url, \
               r.topics, r.starred_at, r.created_at, r.updated_at \
               FROM repositories r \
               INNER JOIN repos_fts ON repos_fts.rowid = r.id \
               WHERE repos_fts MATCH ?1 \
               ORDER BY rank \
               LIMIT 50";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let repos = stmt
        .query_map([&fts_query], |row| {
            let topics_str: String = row.get(10)?;
            let topics: Vec<String> =
                serde_json::from_str(&topics_str).unwrap_or_default();

            Ok(Repo {
                id: row.get(0)?,
                github_id: row.get(1)?,
                name: row.get(2)?,
                full_name: row.get(3)?,
                description: row.get(4)?,
                html_url: row.get(5)?,
                language: row.get(6)?,
                stargazers_count: row.get(7)?,
                owner_login: row.get(8)?,
                owner_avatar_url: row.get(9)?,
                topics,
                starred_at: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // 批量加载 tags
    let repo_ids: Vec<i64> = repos.iter().map(|r| r.id).collect();
    let mut tags_map = batch_load_tags(&conn, &repo_ids);

    let repos_with_tags = repos
        .into_iter()
        .map(|mut repo| {
            repo.tags = tags_map.remove(&repo.id).unwrap_or_default();
            repo
        })
        .collect();

    Ok(repos_with_tags)
}

#[tauri::command]
pub fn get_repo_count_by_language(state: State<DbState>) -> Result<Vec<LangCount>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let sql = "SELECT language, COUNT(*) as count FROM repositories \
               WHERE language IS NOT NULL AND language != '' \
               GROUP BY language ORDER BY count DESC";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let langs = stmt
        .query_map([], |row| {
            Ok(LangCount {
                language: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(langs)
}

#[tauri::command]
pub fn get_total_repo_count(state: State<DbState>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM repositories", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count)
}
