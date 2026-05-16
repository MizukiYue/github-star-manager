pub mod commands;
pub mod db;
pub mod github;
pub mod models;

use commands::repos::DbState;
use rusqlite::Connection;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 获取应用数据目录
    let db_path = get_db_path();

    // 确保目录存在
    if let Some(parent) = std::path::Path::new(&db_path).parent() {
        std::fs::create_dir_all(parent).expect("Failed to create data directory");
    }

    // 初始化数据库
    let conn = Connection::open(&db_path).expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            commands::repos::get_repos,
            commands::repos::search_repos,
            commands::repos::get_repo_count_by_language,
            commands::repos::get_total_repo_count,
            commands::tags::get_tags,
            commands::tags::create_tag,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            commands::tags::add_tag_to_repo,
            commands::tags::remove_tag_from_repo,
            commands::sync::sync_stars,
            commands::settings::get_token,
            commands::settings::save_token,
            commands::settings::get_last_sync_time,
            commands::ai::summarize_repo,
            commands::ai::get_cached_summary,
            commands::ai::get_ai_config,
            commands::ai::save_ai_config,
            commands::ai::fetch_models,
            commands::ai::ai_auto_tag,
            commands::oauth::save_oauth_config,
            commands::oauth::get_oauth_config,
            commands::oauth::start_oauth,
            commands::oauth::wait_oauth_callback,
            commands::notes::get_note,
            commands::notes::save_note,
            commands::notes::get_repos_with_notes,
            commands::stats::get_stats_overview,
            commands::stats::get_tag_distribution,
            commands::stats::get_stars_histogram,
            commands::stats::get_monthly_starred,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_db_path() -> String {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("github-star-manager");

    data_dir
        .join("stars.db")
        .to_string_lossy()
        .to_string()
}
