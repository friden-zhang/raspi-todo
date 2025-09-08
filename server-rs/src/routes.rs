use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;
use sqlx::types::chrono::Utc;
use std::sync::Arc;

use crate::{
    db::SqlitePool,
    error::{ApiError, ApiResult},
    model::{
        Category, CategoryCreate, CategoryUpdate, Health, ReorderItem, Todo, TodoCreate, TodoUpdate,
    },
    ws::WsHub,
};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub hub: Arc<WsHub>,
}

pub fn api_router() -> Router<AppState> {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/todos", get(list_todos).post(create_todo))
        .route(
            "/api/todos/{id}",
            get(get_todo).put(update_todo).delete(delete_todo),
        )
        .route(
            "/api/todos/{id}/status",
            axum::routing::patch(update_status),
        )
        .route("/api/todos/reorder", post(reorder))
        .route(
            "/api/categories",
            get(list_categories).post(create_category),
        )
        .route(
            "/api/categories/{id}",
            get(get_category)
                .put(update_category)
                .delete(delete_category),
        )
}

async fn health() -> Json<Health> {
    Json(Health {
        ok: true,
        db: "ok".into(),
    })
}

#[derive(Deserialize)]
struct ListParams {
    status: Option<String>,
    include_deleted: Option<bool>,
}

async fn list_todos(
    State(st): State<AppState>,
    Query(p): Query<ListParams>,
) -> ApiResult<Json<Vec<Todo>>> {
    let include_flag = if p.include_deleted.unwrap_or(false) {
        1_i64
    } else {
        0_i64
    };
    let rows = sqlx::query_as::<_, Todo>(
        r#"
        SELECT * FROM todos
        WHERE
            (?1 IS NULL OR status = ?1)
        AND
            (?2 != 0 OR deleted = 0)
        ORDER BY
            priority DESC,
            COALESCE(due_at, '9999-12-31T00:00:00Z') ASC,
            sort_order ASC,
            created_at ASC
    "#,
    )
    .bind(p.status) // ?1
    .bind(include_flag) // ?2
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_todo(
    State(st): State<AppState>,
    Json(body): Json<TodoCreate>,
) -> ApiResult<Json<Todo>> {
    let todo = Todo::new_from_create(body);
    sqlx::query(r#"
        INSERT INTO todos (id,title,note,status,priority,due_at,tags,category_id,sort_order,created_at,updated_at,deleted)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
    "#)
        .bind(&todo.id)
        .bind(&todo.title)
        .bind(&todo.note)
        .bind(&todo.status)
        .bind(todo.priority)
        .bind(todo.due_at)
        .bind(&todo.tags)
        .bind(&todo.category_id)
        .bind(todo.sort_order)
        .bind(todo.created_at)
        .bind(todo.updated_at)
        .bind(todo.deleted)
        .execute(&st.pool)
        .await?;

    let event = json!({"type":"todo.created","data": &todo});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(todo))
}

async fn get_todo(State(st): State<AppState>, Path(id): Path<String>) -> ApiResult<Json<Todo>> {
    let row = sqlx::query_as::<_, Todo>("SELECT * FROM todos WHERE id=?1")
        .bind(&id)
        .fetch_optional(&st.pool)
        .await?;
    match row {
        Some(t) => Ok(Json(t)),
        None => Err(ApiError::NotFound),
    }
}

async fn update_todo(
    State(st): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<TodoUpdate>,
) -> ApiResult<Json<Todo>> {
    let mut t: Todo = sqlx::query_as("SELECT * FROM todos WHERE id=?1")
        .bind(&id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

    if let Some(v) = body.title {
        t.title = v;
    }
    if let Some(v) = body.note {
        t.note = Some(v);
    }
    if let Some(v) = body.status {
        t.status = v;
    }
    if let Some(v) = body.priority {
        t.priority = v;
    }
    if let Some(v) = body.due_at {
        t.due_at = Some(v);
    }
    if let Some(v) = body.tags {
        t.tags = Some(v);
    }
    if let Some(v) = body.category_id {
        t.category_id = Some(v);
    }
    if let Some(v) = body.sort_order {
        t.sort_order = v;
    }
    if let Some(v) = body.deleted {
        t.deleted = v;
    }
    t.updated_at = Utc::now();

    sqlx::query(
        r#"
        UPDATE todos SET
        title=?2, note=?3, status=?4, priority=?5, due_at=?6, tags=?7,
        category_id=?8, sort_order=?9, updated_at=?10, deleted=?11
        WHERE id=?1
    "#,
    )
    .bind(&t.id)
    .bind(&t.title)
    .bind(&t.note)
    .bind(&t.status)
    .bind(t.priority)
    .bind(t.due_at)
    .bind(&t.tags)
    .bind(&t.category_id)
    .bind(t.sort_order)
    .bind(t.updated_at)
    .bind(t.deleted)
    .execute(&st.pool)
    .await?;

    let event = json!({"type":"todo.updated","data": &t});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(t))
}

async fn update_status(
    State(st): State<AppState>,
    Path(id): Path<String>,
    Query(mut q): Query<std::collections::HashMap<String, String>>,
) -> ApiResult<Json<Todo>> {
    let status = q
        .remove("status")
        .ok_or_else(|| ApiError::BadRequest("missing status".into()))?;
    let mut t: Todo = sqlx::query_as("SELECT * FROM todos WHERE id=?1")
        .bind(&id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;
    t.status = status;
    t.updated_at = Utc::now();

    sqlx::query("UPDATE todos SET status=?2, updated_at=?3 WHERE id=?1")
        .bind(&t.id)
        .bind(&t.status)
        .bind(t.updated_at)
        .execute(&st.pool)
        .await?;

    let event = json!({"type":"todo.updated","data": &t});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(t))
}

async fn delete_todo(
    State(st): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM todos WHERE id=?1")
        .bind(&id)
        .fetch_optional(&st.pool)
        .await?;
    if exists.is_none() {
        return Err(ApiError::NotFound);
    }

    sqlx::query("UPDATE todos SET deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?1")
        .bind(&id)
        .execute(&st.pool)
        .await?;

    let event = json!({"type":"todo.deleted","data": {"id": id}});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(json!({"ok": true})))
}

async fn reorder(
    State(st): State<AppState>,
    Json(items): Json<Vec<ReorderItem>>,
) -> ApiResult<Json<serde_json::Value>> {
    let mut tx = st.pool.begin().await?;
    for it in items.iter() {
        sqlx::query("UPDATE todos SET sort_order=?2, updated_at=CURRENT_TIMESTAMP WHERE id=?1")
            .bind(&it.id)
            .bind(it.sort_order)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;

    let event = json!({"type":"todos.reordered","data": items});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(json!({"ok": true})))
}

// Category endpoints

async fn list_categories(State(st): State<AppState>) -> ApiResult<Json<Vec<Category>>> {
    let rows = sqlx::query_as::<_, Category>(
        "SELECT * FROM categories WHERE deleted = 0 ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_category(
    State(st): State<AppState>,
    Json(body): Json<CategoryCreate>,
) -> ApiResult<Json<Category>> {
    let category = Category::new_from_create(body);
    sqlx::query(
        r#"
        INSERT INTO categories (id,name,color,description,sort_order,created_at,updated_at,deleted)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
    "#,
    )
    .bind(&category.id)
    .bind(&category.name)
    .bind(&category.color)
    .bind(&category.description)
    .bind(category.sort_order)
    .bind(category.created_at)
    .bind(category.updated_at)
    .bind(category.deleted)
    .execute(&st.pool)
    .await?;

    let event = json!({"type":"category.created","data": &category});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(category))
}

async fn get_category(
    State(st): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<Category>> {
    let row = sqlx::query_as::<_, Category>("SELECT * FROM categories WHERE id=?1")
        .bind(&id)
        .fetch_optional(&st.pool)
        .await?;
    match row {
        Some(c) => Ok(Json(c)),
        None => Err(ApiError::NotFound),
    }
}

async fn update_category(
    State(st): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<CategoryUpdate>,
) -> ApiResult<Json<Category>> {
    let mut c: Category = sqlx::query_as("SELECT * FROM categories WHERE id=?1")
        .bind(&id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or(ApiError::NotFound)?;

    if let Some(v) = body.name {
        c.name = v;
    }
    if let Some(v) = body.color {
        c.color = Some(v);
    }
    if let Some(v) = body.description {
        c.description = Some(v);
    }
    if let Some(v) = body.sort_order {
        c.sort_order = v;
    }
    if let Some(v) = body.deleted {
        c.deleted = v;
    }
    c.updated_at = Utc::now();

    sqlx::query(
        r#"
        UPDATE categories SET
        name=?2, color=?3, description=?4, sort_order=?5, updated_at=?6, deleted=?7
        WHERE id=?1
    "#,
    )
    .bind(&c.id)
    .bind(&c.name)
    .bind(&c.color)
    .bind(&c.description)
    .bind(c.sort_order)
    .bind(c.updated_at)
    .bind(c.deleted)
    .execute(&st.pool)
    .await?;

    let event = json!({"type":"category.updated","data": &c});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(c))
}

async fn delete_category(
    State(st): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM categories WHERE id=?1")
        .bind(&id)
        .fetch_optional(&st.pool)
        .await?;
    if exists.is_none() {
        return Err(ApiError::NotFound);
    }

    // Check if there are todos using this category
    let todo_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM todos WHERE category_id=?1 AND deleted=0")
            .bind(&id)
            .fetch_one(&st.pool)
            .await?;

    if todo_count > 0 {
        return Err(ApiError::BadRequest(
            "Cannot delete category that has todos assigned to it".into(),
        ));
    }

    sqlx::query("UPDATE categories SET deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?1")
        .bind(&id)
        .execute(&st.pool)
        .await?;

    let event = json!({"type":"category.deleted","data": {"id": id}});
    let _ = st.hub.tx.send(event.to_string());
    Ok(Json(json!({"ok": true})))
}
