use tauri::State;

use crate::commands::repos::DbState;
use crate::models::Tag;

#[tauri::command]
pub fn get_tags(state: State<DbState>) -> Result<Vec<Tag>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let sql = "SELECT id, name, color, created_at FROM tags ORDER BY name";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tags)
}

#[tauri::command]
pub fn create_tag(state: State<DbState>, name: String, color: String) -> Result<Tag, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        rusqlite::params![name, color],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    let tag = conn
        .query_row(
            "SELECT id, name, color, created_at FROM tags WHERE id = ?1",
            [id],
            |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(tag)
}

#[tauri::command]
pub fn update_tag(
    state: State<DbState>,
    id: i64,
    name: String,
    color: String,
) -> Result<Tag, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE tags SET name = ?1, color = ?2 WHERE id = ?3",
        rusqlite::params![name, color, id],
    )
    .map_err(|e| e.to_string())?;

    let tag = conn
        .query_row(
            "SELECT id, name, color, created_at FROM tags WHERE id = ?1",
            [id],
            |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(tag)
}

#[tauri::command]
pub fn delete_tag(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM repo_tags WHERE tag_id = ?1", [id])
        .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM tags WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn add_tag_to_repo(state: State<DbState>, repo_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR IGNORE INTO repo_tags (repo_id, tag_id) VALUES (?1, ?2)",
        rusqlite::params![repo_id, tag_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn remove_tag_from_repo(
    state: State<DbState>,
    repo_id: i64,
    tag_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM repo_tags WHERE repo_id = ?1 AND tag_id = ?2",
        rusqlite::params![repo_id, tag_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
