use anyhow::Result;
use sqlx::{Pool, Sqlite, sqlite::SqlitePoolOptions};

pub type SqlitePool = Pool<Sqlite>;

pub async fn init_pool(database_url: &str) -> Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    // Create categories table first (referenced by todos)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT,
            description TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0
        )
    "#,
    )
    .execute(&pool)
    .await?;

    // Create todos table with category_id reference
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
            category_id TEXT,
            sort_order INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted INTEGER NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )
    "#,
    )
    .execute(&pool)
    .await?;

    // Check if category_id column exists in todos table (for existing databases)
    let column_exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pragma_table_info('todos') WHERE name='category_id'",
    )
    .fetch_one(&pool)
    .await?;

    // Add category_id column if it doesn't exist (migration for existing data)
    if column_exists == 0 {
        sqlx::query("ALTER TABLE todos ADD COLUMN category_id TEXT")
            .execute(&pool)
            .await?;
    }

    // Insert default categories if none exist
    let category_count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM categories WHERE deleted = 0")
            .fetch_one(&pool)
            .await?;

    if category_count == 0 {
        let default_categories = vec![
            ("General", "#6B7280", "General tasks and items"),
            ("Work", "#3B82F6", "Work-related tasks"),
            ("Personal", "#EF4444", "Personal tasks and reminders"),
            ("Shopping", "#10B981", "Shopping lists and items"),
            ("Health", "#F59E0B", "Health and fitness related"),
        ];

        for (name, color, description) in default_categories {
            let id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();
            sqlx::query(
                "INSERT INTO categories (id, name, color, description, sort_order, created_at, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, 0)"
            )
            .bind(&id)
            .bind(name)
            .bind(color)
            .bind(description)
            .bind(&now)
            .bind(&now)
            .execute(&pool)
            .await?;
        }
    }

    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(&pool)
        .await?;

    Ok(pool)
}
