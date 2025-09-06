/**
 * Main entry point for the Rust Todo Server
 *
 * This file sets up a modern async web server using:
 * - Axum: High-performance web framework (similar to Express.js but faster)
 * - Tokio: Async runtime (like async/await in modern C++)
 * - SQLite: Embedded database
 * - WebSocket: Real-time bidirectional communication
 *
 * Architecture Pattern:
 * This follows a layered architecture similar to enterprise C++ applications:
 * - Presentation Layer (Routes/Handlers)
 * - Business Logic Layer (Models/Services)
 * - Data Access Layer (Database)
 * - Cross-cutting concerns (Logging, CORS, WebSocket)
 */
// Module declarations - Similar to #include in C++, but with better dependency management
mod db; // Database connection and initialization
mod error; // Error handling and custom error types
mod model; // Data models/structs (like C++ classes)
mod routes; // HTTP route handlers (like controller classes in C++)
mod ws; // WebSocket handling for real-time communication

use std::{env, path::PathBuf, sync::Arc};

// Axum framework imports - Web server components
use axum::{
    Router,                             // Application router (like URL dispatcher)
    extract::{State, WebSocketUpgrade}, // Dependency injection and WebSocket upgrade
    response::Response,                 // HTTP response type
    routing::get,                       // HTTP GET route helper
};

// Tower HTTP middleware - Similar to middleware in Express.js
use tower_http::{
    cors::CorsLayer,                 // Cross-Origin Resource Sharing
    services::{ServeDir, ServeFile}, // Static file serving
    trace::TraceLayer,               // HTTP request/response logging
};

// Structured logging - Better than printf debugging
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Internal module imports
use crate::{
    db::init_pool,                  // Database connection pool
    routes::{AppState, api_router}, // API routes and shared application state
    ws::{WsHub, ws_handler},        // WebSocket handling
};

/**
 * WebSocket handler route wrapper
 *
 * This function adapts our WebSocket handler to work with Axum's routing system.
 * It extracts the application state and passes it to the WebSocket handler.
 *
 * Pattern: Adapter pattern - adapting incompatible interfaces
 */
async fn ws_handler_route(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws_handler(ws, state.hub).await
}

/**
 * Main application entry point
 *
 * The #[tokio::main] attribute transforms this into an async main function.
 * This is similar to how you might use std::async in modern C++.
 *
 * Return type: anyhow::Result<()> provides ergonomic error handling
 * (similar to std::expected in C++23 or Result<T,E> in other languages)
 */
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize structured logging subsystem
    // This is more sophisticated than std::cout - provides leveled, filterable logs
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            // Use RUST_LOG environment variable, default to "info" level
            env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer()) // Human-readable console output
        .init();

    // Configuration from environment variables (12-factor app methodology)
    // Similar to reading from config files, but more deployment-friendly
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8000);
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://./data/todo.db".into());
    let static_dir = env::var("STATIC_DIR").unwrap_or_else(|_| "../server/static".into());

    // Ensure data directory exists (similar to mkdir -p)
    std::fs::create_dir_all("./data").ok();

    // Initialize database connection pool
    // Connection pooling is crucial for performance - reuses connections
    let pool = init_pool(&db_url).await?;

    // Create WebSocket broadcast hub wrapped in Arc (Atomic Reference Counting)
    // Arc is similar to std::shared_ptr in C++ - allows safe sharing between threads
    let hub = Arc::new(WsHub::new());

    // Application state - shared across all request handlers
    // This is dependency injection pattern - all handlers get access to DB and WebSocket
    let state = AppState {
        pool,
        hub: hub.clone(),
    };

    // Build the application router
    // This is the main HTTP request dispatcher
    let mut app = Router::new()
        .merge(api_router()) // Mount API routes (REST endpoints)
        .route("/ws/updates", get(ws_handler_route)) // WebSocket endpoint
        .with_state(state) // Inject shared state
        .layer(CorsLayer::very_permissive()) // Enable CORS for web browsers
        .layer(TraceLayer::new_for_http()); // Add HTTP request logging

    // Static file serving (for React frontend)
    // This serves the built React application
    let static_path = PathBuf::from(&static_dir);
    if static_path.exists() {
        let index = static_path.join("index.html");
        // Serve static files, fallback to index.html for SPA routing
        let svc = ServeDir::new(static_path).not_found_service(ServeFile::new(index));
        app = app.nest_service("/", svc);
    }

    // Bind to network address and start the server
    // 0.0.0.0 means listen on all network interfaces
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(?addr, "server listening");

    // Start the async HTTP server
    // This is the event loop - similar to io_context.run() in Boost.Asio
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}
