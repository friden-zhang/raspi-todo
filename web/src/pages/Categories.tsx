/**
 * Categories Page - Category-based Todo View
 *
 * This page provides a categorized view of todos, allowing users to:
 * - View todos organized by categories
 * - Each category shows todos grouped by priority
 * - Manage categories (create, update, delete)
 * - Better organize and browse todos
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '../api'
import type { Todo, Category } from '../types'
import { WSClient } from '../ws'
import { Icon } from '../components/Icon'
import { TodoDetailModal } from '../components/TodoDetailModal'

interface CategoryWithTodos {
  category: Category | null // null for uncategorized todos
  todos: Todo[]
}

export default function Categories() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  )
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    color: '#6B7280',
    description: '',
  })
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)

  // Predefined colors for categories
  const colorOptions = [
    '#6B7280',
    '#3B82F6',
    '#EF4444',
    '#10B981',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16',
    '#F97316',
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [todosData, categoriesData] = await Promise.all([
        api.listTodos(),
        api.listCategories(),
      ])
      setTodos(todosData.filter(t => !t.deleted))
      setCategories(categoriesData.filter(c => !c.deleted))
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // WebSocket for real-time updates
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (
          data.type?.startsWith('todo.') ||
          data.type?.startsWith('category.')
        ) {
          loadData()
        }
      } catch (error) {
        console.error('WebSocket message error:', error)
      }
    }

    const ws = new WSClient(handleMessage)
    return () => {
      ws.stop()
    }
  }, [loadData])

  // Group todos by category
  const categoriesWithTodos = useMemo<CategoryWithTodos[]>(() => {
    const categoryMap = new Map<string, CategoryWithTodos>()

    // Initialize all categories
    categories.forEach(category => {
      categoryMap.set(category.id, { category, todos: [] })
    })

    // Add uncategorized group
    categoryMap.set('uncategorized', { category: null, todos: [] })

    // Distribute todos into categories
    todos.forEach(todo => {
      const categoryId = todo.category_id || 'uncategorized'
      const group = categoryMap.get(categoryId)
      if (group) {
        group.todos.push(todo)
      } else {
        // If category doesn't exist, put in uncategorized
        categoryMap.get('uncategorized')!.todos.push(todo)
      }
    })

    // Sort todos within each category by priority and due date
    categoryMap.forEach(group => {
      group.todos.sort((a, b) => {
        // First by priority (high to low)
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        // Then by due date (earliest first, null dates last)
        if (a.due_at && b.due_at) {
          return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
        }
        if (a.due_at && !b.due_at) return -1
        if (!a.due_at && b.due_at) return 1
        // Finally by creation date
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    })

    // Convert to array and sort categories
    return Array.from(categoryMap.values())
      .filter(group => group.todos.length > 0 || group.category) // Show empty categories but hide empty uncategorized
      .sort((a, b) => {
        // Uncategorized always last
        if (!a.category) return 1
        if (!b.category) return -1
        // Other categories by sort_order then name
        if (a.category.sort_order !== b.category.sort_order) {
          return a.category.sort_order - b.category.sort_order
        }
        return a.category.name.localeCompare(b.category.name)
      })
  }, [todos, categories])

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createCategory({
        name: categoryForm.name,
        color: categoryForm.color,
        description: categoryForm.description || null,
      })
      setCategoryForm({ name: '', color: '#6B7280', description: '' })
      setShowCategoryForm(false)
      loadData()
    } catch (error) {
      console.error('Failed to create category:', error)
    }
  }

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return

    try {
      await api.updateCategory(editingCategory.id, {
        name: categoryForm.name,
        color: categoryForm.color,
        description: categoryForm.description || null,
      })
      setEditingCategory(null)
      setCategoryForm({ name: '', color: '#6B7280', description: '' })
      loadData()
    } catch (error) {
      console.error('Failed to update category:', error)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this category? All todos in this category will become uncategorized.'
      )
    ) {
      return
    }

    try {
      // First, update all todos in this category to remove category_id
      const todosInCategory = todos.filter(t => t.category_id === categoryId)
      await Promise.all(
        todosInCategory.map(todo =>
          api.updateTodo(todo.id, { category_id: null })
        )
      )

      // Then delete the category
      await api.deleteCategory(categoryId)
      loadData()
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert(
        'Failed to delete category. Make sure there are no todos assigned to it.'
      )
    }
  }

  const startEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name,
      color: category.color || '#6B7280',
      description: category.description || '',
    })
    setShowCategoryForm(true)
  }

  const cancelEdit = () => {
    setEditingCategory(null)
    setCategoryForm({ name: '', color: '#6B7280', description: '' })
    setShowCategoryForm(false)
  }

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 0:
        return 'Low'
      case 1:
        return 'Medium'
      case 2:
        return 'High'
      case 3:
        return 'Urgent'
      default:
        return 'Unknown'
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 0:
        return '#6B7280' // Gray
      case 1:
        return '#3B82F6' // Blue
      case 2:
        return '#F59E0B' // Orange
      case 3:
        return '#EF4444' // Red
      default:
        return '#6B7280'
    }
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

  const handleTodoStatusChange = async (todo: Todo, newStatus: string) => {
    try {
      await api.updateStatus(todo.id, newStatus)
      loadData()
    } catch (error) {
      console.error('Failed to update todo status:', error)
    }
  }

  // Toggle category collapse
  const toggleCategoryCollapse = (categoryId: string) => {
    console.log('Toggle collapse for category:', categoryId)
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        console.log('Expanding category:', categoryId)
        newSet.delete(categoryId)
      } else {
        console.log('Collapsing category:', categoryId)
        newSet.add(categoryId)
      }
      console.log('New collapsed set:', Array.from(newSet))
      return newSet
    })
  }

  // Handle todo update from detail modal
  const handleTodoUpdate = async (updatedTodo: Todo) => {
    try {
      await api.updateTodo(updatedTodo.id, updatedTodo)
      setSelectedTodo(null)
      loadData()
    } catch (error) {
      console.error('Failed to update todo:', error)
    }
  }

  // Handle todo delete from detail modal
  const handleTodoDelete = async (todoId: string) => {
    try {
      await api.deleteTodo(todoId)
      setSelectedTodo(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete todo:', error)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading categories...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="categories-page">
        <header className="page-header">
          <h1>
            <Icon name="folder" size={24} />
            Categories
          </h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCategoryForm(true)}
          >
            <Icon name="plus" size={16} />
            New Category
          </button>
        </header>

        {/* Category Form Modal */}
        {showCategoryForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </h2>
                <button
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  onClick={cancelEdit}
                >
                  <Icon name="x" size={20} />
                </button>
              </div>
              <form
                onSubmit={
                  editingCategory ? handleUpdateCategory : handleCreateCategory
                }
                className="p-6 space-y-4"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="category-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Name
                  </label>
                  <input
                    id="category-name"
                    type="text"
                    value={categoryForm.name}
                    onChange={e =>
                      setCategoryForm(prev => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Category name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="category-color"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          categoryForm.color === color
                            ? 'border-gray-800 scale-110'
                            : 'border-gray-300 hover:border-gray-500'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setCategoryForm(prev => ({ ...prev, color }))
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="category-description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="category-description"
                    value={categoryForm.description}
                    onChange={e =>
                      setCategoryForm(prev => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Category description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {editingCategory ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Categories Grid */}
        <div className="categories-grid">
          {categoriesWithTodos.map((group, index) => (
            <div
              key={group.category?.id || 'uncategorized'}
              className="category-card"
            >
              <div className="category-header">
                <div
                  className="category-info cursor-pointer hover:bg-blue-50 hover:border-blue-200 rounded-lg p-3 -m-1 transition-all duration-200 flex-1 border border-transparent"
                  onClick={() =>
                    toggleCategoryCollapse(
                      group.category?.id || 'uncategorized'
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center">
                      <Icon
                        name={
                          collapsedCategories.has(
                            group.category?.id || 'uncategorized'
                          )
                            ? 'chevron-right'
                            : 'chevron-down'
                        }
                        size={20}
                        className="text-gray-600"
                      />
                    </div>
                    <div
                      className="category-color flex-shrink-0"
                      style={{
                        backgroundColor: group.category?.color || '#6B7280',
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {group.category?.name || 'Uncategorized'}
                        </h3>
                        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {group.todos.length} todos
                        </span>
                      </div>
                      {group.category?.description && (
                        <p className="category-description text-gray-600 mt-1">
                          {group.category.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {group.category && (
                  <div className="category-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => startEditCategory(group.category!)}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteCategory(group.category!.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Todos grouped by priority */}
              {!collapsedCategories.has(
                group.category?.id || 'uncategorized'
              ) && (
                <div className="todos-by-priority mt-4">
                  {[3, 2, 1, 0].map(priority => {
                    const priorityTodos = group.todos.filter(
                      t => t.priority === priority
                    )
                    if (priorityTodos.length === 0) return null

                    return (
                      <div key={priority} className="priority-group">
                        <div
                          className="priority-header"
                          style={{ color: getPriorityColor(priority) }}
                        >
                          <Icon name="flag" size={14} />
                          <span>
                            {getPriorityLabel(priority)} ({priorityTodos.length}
                            )
                          </span>
                        </div>
                        <div className="priority-todos">
                          {priorityTodos.map(todo => (
                            <div
                              key={todo.id}
                              className={`todo-item status-${todo.status}`}
                            >
                              <div
                                className="todo-content cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => setSelectedTodo(todo)}
                              >
                                <div className="todo-title">{todo.title}</div>
                                {todo.note && (
                                  <div className="todo-note">{todo.note}</div>
                                )}
                                {todo.due_at && (
                                  <div className="todo-due">
                                    <Icon name="calendar" size={12} />
                                    <span
                                      className={
                                        new Date(todo.due_at) < new Date()
                                          ? 'overdue'
                                          : ''
                                      }
                                    >
                                      {formatDate(todo.due_at)}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="todo-actions">
                                <select
                                  value={todo.status}
                                  onChange={e =>
                                    handleTodoStatusChange(todo, e.target.value)
                                  }
                                  className="status-select"
                                >
                                  <option value="todo">Todo</option>
                                  <option value="doing">Doing</option>
                                  <option value="done">Done</option>
                                  <option value="archived">Archived</option>
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {categoriesWithTodos.length === 0 && (
          <div className="empty-state">
            <Icon name="folder" size={48} />
            <h3>No categories yet</h3>
            <p>Create your first category to organize your todos</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCategoryForm(true)}
            >
              <Icon name="plus" size={16} />
              Create Category
            </button>
          </div>
        )}
      </div>

      {/* Todo Detail Modal */}
      <TodoDetailModal
        todo={selectedTodo}
        categories={categories}
        isOpen={!!selectedTodo}
        onClose={() => setSelectedTodo(null)}
        onUpdate={handleTodoUpdate}
        onDelete={handleTodoDelete}
      />
    </div>
  )
}
