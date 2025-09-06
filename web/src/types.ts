/**
 * TypeScript Type Definitions for Todo Application
 *
 * This file defines the data structures used throughout the frontend.
 * TypeScript provides compile-time type safety similar to C++ templates,
 * but with more flexible type inference and structural typing.
 *
 * Key TypeScript Features Demonstrated:
 * - Union types: Multiple possible values (like std::variant)
 * - Optional properties: Safe null handling (like std::optional)
 * - Literal types: Exact string values for enums
 */

/**
 * Main Todo type definition
 *
 * This mirrors the Rust Todo struct but with JavaScript/TypeScript conventions:
 * - camelCase is used instead of snake_case
 * - boolean/number union for deleted field (backend compatibility)
 * - ISO string dates instead of DateTime objects
 *
 * Pattern: Data Transfer Object (DTO)
 * Similar to C++ POD structs but with type safety
 */
export type Todo = {
  id: string // Unique identifier (UUID)
  title: string // Todo title (required)
  note?: string | null // Optional note (nullable)
  status: 'todo' | 'doing' | 'done' | 'archived' // Workflow state (union type)
  priority: 0 | 1 | 2 | 3 // Priority level (literal types)
  due_at?: string | null // Optional due date (ISO string)
  tags?: string | null // Optional tags
  sort_order: number // Manual sorting order
  created_at: string // Creation timestamp (ISO string)
  updated_at: string // Last update timestamp (ISO string)
  deleted: boolean | number // Soft delete flag (backend sends 0/1, frontend uses boolean)
}
