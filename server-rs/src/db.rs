use anyhow::Result;
use sqlx::{Pool, Sqlite, sqlite::SqlitePoolOptions};

pub type SqlitePool = Pool<Sqlite>;

pub async fn init_pool(database_url: &str) -> Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            note TEXT,
            status TEXT NOT NULL,
            priority INTEGER NOT NULL,
            due_at TEXT,
            tags TEXT,
            sort_order INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted INTEGER NOT NULL
        )
    "#,
    )
    .execute(&pool)
    .await?;

    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(&pool)
        .await?;

    Ok(pool)
}
