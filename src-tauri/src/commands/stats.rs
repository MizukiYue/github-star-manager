use serde::Serialize;
use tauri::State;

use crate::commands::repos::DbState;

#[derive(Debug, Clone, Serialize)]
pub struct StatsOverview {
    pub total_repos: i64,
    pub total_tags: i64,
    pub total_languages: i64,
    pub total_with_notes: i64,
    pub avg_stars: f64,
    pub max_stars_repo: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TagCount {
    pub name: String,
    pub color: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StarsBucket {
    pub label: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct MonthlyCount {
    pub month: String,
    pub count: i64,
}

#[tauri::command]
pub fn get_stats_overview(state: State<DbState>) -> Result<StatsOverview, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let total_repos: i64 = conn
        .query_row("SELECT COUNT(*) FROM repositories", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let total_tags: i64 = conn
        .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let total_languages: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT language) FROM repositories WHERE language IS NOT NULL AND language != ''",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_with_notes: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE content != ''",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let avg_stars: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG(stargazers_count), 0) FROM repositories",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let max_stars_repo: Option<String> = conn
        .query_row(
            "SELECT full_name FROM repositories ORDER BY stargazers_count DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    Ok(StatsOverview {
        total_repos,
        total_tags,
        total_languages,
        total_with_notes,
        avg_stars,
        max_stars_repo,
    })
}

#[tauri::command]
pub fn get_tag_distribution(state: State<DbState>) -> Result<Vec<TagCount>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let sql = "SELECT t.name, t.color, COUNT(rt.repo_id) as count \
               FROM tags t \
               LEFT JOIN repo_tags rt ON t.id = rt.tag_id \
               GROUP BY t.id \
               ORDER BY count DESC";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([], |row| {
            Ok(TagCount {
                name: row.get(0)?,
                color: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

#[tauri::command]
pub fn get_stars_histogram(state: State<DbState>) -> Result<Vec<StarsBucket>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let buckets = vec![
        ("0-10", 0i64, 10i64),
        ("10-100", 10, 100),
        ("100-1k", 100, 1000),
        ("1k-10k", 1000, 10000),
        ("10k+", 10000, i64::MAX),
    ];

    let mut results = Vec::new();

    for (label, min, max) in buckets {
        let count: i64 = if max == i64::MAX {
            conn.query_row(
                "SELECT COUNT(*) FROM repositories WHERE stargazers_count >= ?1",
                [min],
                |row| row.get(0),
            )
            .unwrap_or(0)
        } else {
            conn.query_row(
                "SELECT COUNT(*) FROM repositories WHERE stargazers_count >= ?1 AND stargazers_count < ?2",
                rusqlite::params![min, max],
                |row| row.get(0),
            )
            .unwrap_or(0)
        };

        results.push(StarsBucket {
            label: label.to_string(),
            count,
        });
    }

    Ok(results)
}

#[tauri::command]
pub fn get_monthly_starred(state: State<DbState>) -> Result<Vec<MonthlyCount>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let sql = "SELECT strftime('%Y-%m', starred_at) as month, COUNT(*) as count \
               FROM repositories \
               WHERE starred_at IS NOT NULL \
               AND starred_at >= date('now', '-12 months') \
               GROUP BY month \
               ORDER BY month ASC";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let results = stmt
        .query_map([], |row| {
            Ok(MonthlyCount {
                month: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}
