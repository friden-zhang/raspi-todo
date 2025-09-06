/**
 * Data Models and Transfer Objects
 *
 * This file defines the core data structures for the Todo application.
 * In C++ terms, these are like POD (Plain Old Data) structs, but with
 * automatic serialization/deserialization capabilities.
 *
 * Key Rust Features Demonstrated:
 * - Derive macros: Automatic trait implementations (like template specialization)
 * - Option<T>: Safe null handling (similar to std::optional in C++17)
 * - Ownership: No need for manual memory management
 */
use chrono::{DateTime, Utc}; // Date/time handling (like std::chrono in C++)
use serde::{Deserialize, Serialize}; // JSON serialization (like nlohmann/json)
use sqlx::FromRow; // Database row mapping
use uuid::Uuid; // UUID generation

/**
 * Main Todo entity - represents a todo item in the database
 *
 * Derive macros automatically implement common traits:
 * - Debug: For debugging output (like operator<< overload)
 * - Clone: Deep copy capability (like copy constructor)
 * - Serialize/Deserialize: JSON conversion (automated marshalling)
 * - FromRow: Database row to struct mapping (like ORM)
 *
 * This pattern is similar to C++ structs but with automatic serialization
 */
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Todo {
    pub id: String,                    // UUIDv4 string - Primary key
    pub title: String,                 // Todo title - Required field
    pub note: Option<String>,          // Optional note (like std::optional)
    pub status: String,                // Workflow state: todo/doing/done/archived
    pub priority: i64,                 // Priority level: 0 (low) to 3 (high)
    pub due_at: Option<DateTime<Utc>>, // Optional due date with timezone
    pub tags: Option<String>,          // Optional tags (MVP implementation)
    pub sort_order: i64,               // Manual sorting order
    pub created_at: DateTime<Utc>,     // Creation timestamp
    pub updated_at: DateTime<Utc>,     // Last modification timestamp
    pub deleted: i64,                  // Soft delete flag: 0=active, 1=deleted
                                       // Note: Using i64 instead of bool for SQLite compatibility
}

/**
 * Data Transfer Object for creating new todos
 *
 * This is a separate struct from Todo because:
 * 1. We don't want clients to set id, timestamps, etc.
 * 2. All fields except title are optional for creation
 * 3. Follows the Command pattern for operations
 *
 * Similar to a C++ struct used for function parameters
 */
#[derive(Debug, Clone, Deserialize)]
pub struct TodoCreate {
    pub title: String,                 // Required: what needs to be done
    pub note: Option<String>,          // Optional: additional details
    pub priority: Option<i64>,         // Optional: defaults to 0 if not specified
    pub due_at: Option<DateTime<Utc>>, // Optional: when it should be completed
    pub tags: Option<String>,          // Optional: categorization
}

/**
 * Data Transfer Object for updating existing todos
 *
 * All fields are optional because this supports partial updates.
 * This is the PATCH semantics - only update fields that are provided.
 *
 * Pattern: Builder pattern variation - allows incremental construction
 */
#[derive(Debug, Clone, Deserialize)]
pub struct TodoUpdate {
    pub title: Option<String>,         // Update title
    pub note: Option<String>,          // Update or clear note
    pub status: Option<String>,        // Change workflow status
    pub priority: Option<i64>,         // Change priority level
    pub due_at: Option<DateTime<Utc>>, // Update or clear due date
    pub tags: Option<String>,          // Update or clear tags
    pub sort_order: Option<i64>,       // Change sort position
    pub deleted: Option<i64>,          // Soft delete/undelete
}

/**
 * Data Transfer Object for bulk reordering
 *
 * Used when user drags and drops todos to reorder them.
 * Contains just the essential information needed for sorting.
 *
 * Pattern: Value Object - immutable data holder
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderItem {
    pub id: String,      // Which todo to move
    pub sort_order: i64, // New position in the list
}

/**
 * Health check response
 *
 * Simple status indicator for monitoring and debugging.
 * Used by load balancers and monitoring systems.
 *
 * Pattern: Status Object - provides system health information
 */
#[derive(Debug, Serialize)]
pub struct Health {
    pub ok: bool,   // Overall system status
    pub db: String, // Database status message
}

/**
 * Implementation block for Todo struct
 *
 * This is similar to class methods in C++, but defined separately.
 * Contains factory methods and business logic.
 */
impl Todo {
    /**
     * Factory method to create a new Todo from TodoCreate request
     *
     * This is a constructor-like method that:
     * 1. Generates a new UUID for the todo
     * 2. Sets default values for system fields
     * 3. Uses provided values for user fields
     *
     * Pattern: Factory Method - encapsulates object creation logic
     * Similar to a C++ factory function or constructor
     */
    pub fn new_from_create(c: TodoCreate) -> Self {
        let now = Utc::now(); // Current timestamp
        Self {
            id: Uuid::new_v4().to_string(),    // Generate unique identifier
            title: c.title,                    // User-provided title
            note: c.note,                      // Optional note
            status: "todo".to_string(),        // Default to "todo" status
            priority: c.priority.unwrap_or(1), // Default priority = 1 (medium)
            due_at: c.due_at,                  // Optional due date
            tags: c.tags,                      // Optional tags
            sort_order: 0,                     // Default sort order
            created_at: now,                   // Set creation time
            updated_at: now,                   // Set update time (same as creation)
            deleted: 0,                        // Default to not deleted
        }
    }
}
