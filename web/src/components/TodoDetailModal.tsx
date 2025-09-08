/**
 * TodoDetailModal - Reusable Todo Detail Modal Component
 *
 * This component provides a unified todo detail modal that can be used
 * across different pages (Admin, MyDay, etc.) to avoid code duplication
 * and ensure consistent behavior.
 */

import React, { useState, useEffect } from 'react'
import { marked } from 'marked'
import { api } from '../api'
import type { Todo, Category } from '../types'
import { Icon } from './Icon'

interface TodoDetailModalProps {
  todo: Todo | null
  categories: Category[]
  isOpen: boolean
  onClose: () => void
  onUpdate: (updatedTodo: Todo) => void
  onDelete?: (todoId: string) => void
}

interface EditForm {
  title: string
  note: string
  priority: number
  due_date: string
  due_time: string
  category_id: string
}

export function TodoDetailModal({
  todo,
  categories,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: TodoDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    title: '',
    note: '',
    priority: 1,
    due_date: '',
    due_time: '',
    category_id: '',
  })

  // Initialize form when todo changes
  useEffect(() => {
    if (todo) {
      const dueDate = todo.due_at ? new Date(todo.due_at) : new Date()
      const dueDateStr = dueDate.toISOString().split('T')[0]
      const dueTimeStr = dueDate.toTimeString().slice(0, 5)

      setEditForm({
        title: todo.title,
        note: todo.note || '',
        priority: todo.priority,
        due_date: dueDateStr,
        due_time: dueTimeStr,
        category_id: todo.category_id || '',
      })
    }
  }, [todo])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false)
      setEditForm({
        title: '',
        note: '',
        priority: 1,
        due_date: '',
        due_time: '',
        category_id: '',
      })
    }
  }, [isOpen])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!todo || !editForm.title.trim()) return

    setLoading(true)
    try {
      const dueDateTime = `${editForm.due_date}T${editForm.due_time}:00Z`

      const updatedTodo = await api.updateTodo(todo.id, {
        title: editForm.title,
        note: editForm.note.trim() || null,
        priority: editForm.priority as 0 | 1 | 2 | 3,
        due_at: dueDateTime,
        category_id: editForm.category_id || null,
      })

      onUpdate(updatedTodo)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update todo:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!todo || !onDelete) return

    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await api.deleteTodo(todo.id)
      onDelete(todo.id)
      onClose()
    } catch (error) {
      console.error('Failed to delete todo:', error)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!todo) return

    try {
      const updatedTodo = await api.updateStatus(todo.id, newStatus)
      onUpdate(updatedTodo)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return 'No category'
    const category = categories.find(c => c.id === categoryId)
    return category?.name || 'Unknown category'
  }

  const getCategoryColor = (categoryId: string | null | undefined) => {
    if (!categoryId) return '#6B7280'
    const category = categories.find(c => c.id === categoryId)
    return category?.color || '#6B7280'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const itemDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )

    if (itemDate.getTime() === today.getTime()) {
      return 'Today'
    } else if (itemDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow'
    } else if (itemDate < today) {
      return 'Overdue'
    } else {
      return date.toLocaleDateString()
    }
  }

  if (!isOpen || !todo) return null

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ maxWidth: '600px', width: '90%' }}
      >
        <div className="modal-header">
          <h3 className="flex items-center gap-2 font-semibold">
            <Icon name="eye" size={20} />
            Task Details
          </h3>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {isEditing ? (
          /* Edit Mode */
          <form onSubmit={handleSave}>
            <div className="space-y-4 p-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title:</label>
                <input
                  className="input w-full"
                  placeholder="Task title (required)"
                  value={editForm.title}
                  onChange={e =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Notes (Markdown):
                </label>
                <textarea
                  className="textarea w-full"
                  placeholder="**Bold text**, *italic*, `code`, lists, etc."
                  value={editForm.note}
                  onChange={e =>
                    setEditForm({ ...editForm, note: e.target.value })
                  }
                  rows={8}
                />
                <div className="text-xs text-muted mt-1">
                  Use Markdown syntax: **bold**, *italic*, `code`, - lists
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Priority:
                  </label>
                  <select
                    className="select w-full"
                    value={editForm.priority}
                    onChange={e =>
                      setEditForm({
                        ...editForm,
                        priority: parseInt(e.target.value),
                      })
                    }
                  >
                    <option value={0}>Low Priority</option>
                    <option value={1}>Normal Priority</option>
                    <option value={2}>Important</option>
                    <option value={3}>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Category:
                  </label>
                  <select
                    className="select w-full"
                    value={editForm.category_id}
                    onChange={e =>
                      setEditForm({
                        ...editForm,
                        category_id: e.target.value,
                      })
                    }
                  >
                    <option value="">No category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Date:
                  </label>
                  <input
                    type="date"
                    className="input w-full"
                    value={editForm.due_date}
                    onChange={e =>
                      setEditForm({ ...editForm, due_date: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Time:
                  </label>
                  <input
                    type="time"
                    className="input w-full"
                    value={editForm.due_time}
                    onChange={e =>
                      setEditForm({ ...editForm, due_time: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !editForm.title.trim()}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <div className="space-y-4 p-4">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-semibold">{todo.title}</h2>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setIsEditing(true)}
                >
                  <Icon name="edit" size={14} />
                  Edit
                </button>
                {onDelete && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={handleDelete}
                  >
                    <Icon name="trash" size={14} />
                    Delete
                  </button>
                )}
              </div>
            </div>

            {todo.note && (
              <div className="prose">
                <div
                  dangerouslySetInnerHTML={{
                    __html: marked(todo.note, {
                      gfm: true,
                      breaks: true,
                    }),
                  }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Priority:</strong>
                <span
                  className={`priority-badge priority-${todo.priority} ml-2`}
                >
                  {todo.priority === 0 && 'Low Priority'}
                  {todo.priority === 1 && 'Normal'}
                  {todo.priority === 2 && 'Important'}
                  {todo.priority === 3 && 'Urgent'}
                </span>
              </div>

              <div>
                <strong>Category:</strong>
                <span className="ml-2 inline-flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: getCategoryColor(todo.category_id),
                    }}
                  />
                  {getCategoryName(todo.category_id)}
                </span>
              </div>

              <div>
                <strong>Status:</strong>
                <select
                  className="ml-2 text-sm border rounded px-2 py-1"
                  value={todo.status}
                  onChange={e => handleStatusChange(e.target.value)}
                >
                  <option value="todo">Todo</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {todo.due_at && (
                <div>
                  <strong>Due:</strong>
                  <span className="ml-2">
                    {formatDate(todo.due_at)} at{' '}
                    {new Date(todo.due_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="text-sm text-muted">
              <div>Created: {new Date(todo.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(todo.updated_at).toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
