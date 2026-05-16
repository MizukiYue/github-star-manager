use rusqlite::{Connection, Result};

pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    description TEXT,
    html_url TEXT NOT NULL,
    language TEXT,
    stargazers_count INTEGER DEFAULT 0,
    owner_login TEXT NOT NULL,
    owner_avatar_url TEXT,
    topics TEXT DEFAULT '[]',
    starred_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repo_tags (
    repo_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (repo_id, tag_id),
    FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS repos_fts USING fts5(
    name, full_name, description, language, topics,
    content='repositories',
    content_rowid='id'
);

-- 触发器：插入时同步 FTS
CREATE TRIGGER IF NOT EXISTS repos_ai AFTER INSERT ON repositories BEGIN
    INSERT INTO repos_fts(rowid, name, full_name, description, language, topics)
    VALUES (new.id, new.name, new.full_name, new.description, new.language, new.topics);
END;

-- 触发器：更新时同步 FTS
CREATE TRIGGER IF NOT EXISTS repos_au AFTER UPDATE ON repositories BEGIN
    INSERT INTO repos_fts(repos_fts, rowid, name, full_name, description, language, topics)
    VALUES ('delete', old.id, old.name, old.full_name, old.description, old.language, old.topics);
    INSERT INTO repos_fts(rowid, name, full_name, description, language, topics)
    VALUES (new.id, new.name, new.full_name, new.description, new.language, new.topics);
END;

-- 触发器：删除时同步 FTS
CREATE TRIGGER IF NOT EXISTS repos_ad AFTER DELETE ON repositories BEGIN
    INSERT INTO repos_fts(repos_fts, rowid, name, full_name, description, language, topics)
    VALUES ('delete', old.id, old.name, old.full_name, old.description, old.language, old.topics);
END;

-- 笔记表
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER UNIQUE NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repos_starred_at ON repositories(starred_at);
CREATE INDEX IF NOT EXISTS idx_repos_github_id ON repositories(github_id);
"#;

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}
