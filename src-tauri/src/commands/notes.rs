use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::repos::DbState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub repo_id: i64,
    pub content: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_note(state: State<DbState>, repo_id: i64) -> Result<Option<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, repo_id, content, updated_at FROM notes WHERE repo_id = ?1",
        [repo_id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                content: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    );

    match result {
        Ok(note) => Ok(Some(note)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_note(state: State<DbState>, repo_id: i64, content: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    if content.trim().is_empty() {
        // 空内容则删除笔记
        conn.execute("DELETE FROM notes WHERE repo_id = ?1", [repo_id])
            .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO notes (repo_id, content, updated_at) VALUES (?1, ?2, datetime('now')) \
             ON CONFLICT(repo_id) DO UPDATE SET content = excluded.content, updated_at = datetime('now')",
            rusqlite::params![repo_id, content],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_repos_with_notes(state: State<DbState>) -> Result<Vec<i64>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT repo_id FROM notes WHERE content != ''")
        .map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ids)
}
