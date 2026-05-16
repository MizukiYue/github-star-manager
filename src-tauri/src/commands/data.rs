use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::repos::DbState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportTag {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRepo {
    pub github_id: i64,
    pub full_name: String,
    pub tags: Vec<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub version: u32,
    pub exported_at: String,
    pub tags: Vec<ExportTag>,
    pub repos: Vec<ExportRepo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub tags_imported: u32,
    pub notes_imported: u32,
    pub tags_linked: u32,
}

#[tauri::command]
pub fn export_data(state: State<DbState>) -> Result<ExportData, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 导出所有标签
    let mut tag_stmt = conn
        .prepare("SELECT name, color FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tags: Vec<ExportTag> = tag_stmt
        .query_map([], |row| {
            Ok(ExportTag {
                name: row.get(0)?,
                color: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // 导出仓库（只导出有标签或笔记的）
    let mut repo_stmt = conn
        .prepare(
            "SELECT r.id, r.github_id, r.full_name FROM repositories r \
             WHERE r.id IN (SELECT repo_id FROM repo_tags) \
             OR r.id IN (SELECT repo_id FROM notes WHERE content != '')",
        )
        .map_err(|e| e.to_string())?;

    let repo_rows: Vec<(i64, i64, String)> = repo_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut repos: Vec<ExportRepo> = Vec::new();

    for (repo_id, github_id, full_name) in repo_rows {
        // 获取该仓库的标签名
        let mut tag_name_stmt = conn
            .prepare(
                "SELECT t.name FROM tags t \
                 JOIN repo_tags rt ON rt.tag_id = t.id \
                 WHERE rt.repo_id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let repo_tags: Vec<String> = tag_name_stmt
            .query_map([repo_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // 获取笔记
        let note: Option<String> = conn
            .query_row(
                "SELECT content FROM notes WHERE repo_id = ?1 AND content != ''",
                [repo_id],
                |row| row.get(0),
            )
            .ok();

        repos.push(ExportRepo {
            github_id,
            full_name,
            tags: repo_tags,
            note,
        });
    }

    let exported_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    Ok(ExportData {
        version: 1,
        exported_at,
        tags,
        repos,
    })
}

#[tauri::command]
pub fn import_data(state: State<DbState>, data: ExportData) -> Result<ImportResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut tags_imported: u32 = 0;
    let mut notes_imported: u32 = 0;
    let mut tags_linked: u32 = 0;

    // 导入标签（不覆盖已有的）
    for tag in &data.tags {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM tags WHERE name = ?1",
                [&tag.name],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !exists {
            conn.execute(
                "INSERT INTO tags (name, color) VALUES (?1, ?2)",
                rusqlite::params![tag.name, tag.color],
            )
            .map_err(|e| e.to_string())?;
            tags_imported += 1;
        }
    }

    // 导入仓库的标签关联和笔记
    for repo in &data.repos {
        // 通过 github_id 或 full_name 查找本地仓库
        let repo_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM repositories WHERE github_id = ?1 OR full_name = ?2",
                rusqlite::params![repo.github_id, repo.full_name],
                |row| row.get(0),
            )
            .ok();

        let Some(repo_id) = repo_id else {
            continue;
        };

        // 关联标签
        for tag_name in &repo.tags {
            let tag_id: Option<i64> = conn
                .query_row(
                    "SELECT id FROM tags WHERE name = ?1",
                    [tag_name],
                    |row| row.get(0),
                )
                .ok();

            if let Some(tag_id) = tag_id {
                let inserted = conn
                    .execute(
                        "INSERT OR IGNORE INTO repo_tags (repo_id, tag_id) VALUES (?1, ?2)",
                        rusqlite::params![repo_id, tag_id],
                    )
                    .map_err(|e| e.to_string())?;
                if inserted > 0 {
                    tags_linked += 1;
                }
            }
        }

        // 导入笔记（不覆盖已有的）
        if let Some(ref note) = repo.note {
            let has_note: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM notes WHERE repo_id = ?1 AND content != ''",
                    [repo_id],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if !has_note {
                conn.execute(
                    "INSERT OR REPLACE INTO notes (repo_id, content, updated_at) VALUES (?1, ?2, datetime('now'))",
                    rusqlite::params![repo_id, note],
                )
                .map_err(|e| e.to_string())?;
                notes_imported += 1;
            }
        }
    }

    Ok(ImportResult {
        tags_imported,
        notes_imported,
        tags_linked,
    })
}
