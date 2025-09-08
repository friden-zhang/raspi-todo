import type { Todo, Category } from './types'

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  listTodos: (status?: string): Promise<Todo[]> =>
    http<Todo[]>(`/api/todos${status ? `?status=${status}` : ''}`),
  createTodo: (data: Partial<Todo>): Promise<Todo> =>
    http<Todo>('/api/todos', { method: 'POST', body: JSON.stringify(data) }),
  getTodo: (id: string): Promise<Todo> => http<Todo>(`/api/todos/${id}`),
  updateTodo: (id: string, data: Partial<Todo>): Promise<Todo> =>
    http<Todo>(`/api/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string): Promise<Todo> =>
    http<Todo>(`/api/todos/${id}/status?status=${status}`, { method: 'PATCH' }),
  deleteTodo: (id: string): Promise<void> =>
    http<void>(`/api/todos/${id}`, { method: 'DELETE' }),
  reorder: (items: { id: string; sort_order: number }[]): Promise<void> =>
    http<void>('/api/todos/reorder', {
      method: 'POST',
      body: JSON.stringify(items),
    }),
  // Category endpoints
  listCategories: (): Promise<Category[]> =>
    http<Category[]>('/api/categories'),
  createCategory: (data: Partial<Category>): Promise<Category> =>
    http<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCategory: (id: string): Promise<Category> =>
    http<Category>(`/api/categories/${id}`),
  updateCategory: (id: string, data: Partial<Category>): Promise<Category> =>
    http<Category>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string): Promise<void> =>
    http<void>(`/api/categories/${id}`, { method: 'DELETE' }),
}

export { API_BASE }
