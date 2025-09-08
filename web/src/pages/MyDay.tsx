import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { marked } from 'marked'
import { api } from '../api'
import type { Todo, Category } from '../types'
import { WSClient } from '../ws'
import { Icon } from '../components/Icon'
import { TodoDetailModal } from '../components/TodoDetailModal'

export default function MyDay() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [loading, setLoading] = useState(false)
  const [skipNextWsUpdate, setSkipNextWsUpdate] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  )

  async function load() {
    const [todosData, categoriesData] = await Promise.all([
      api.listTodos(),
      api.listCategories(),
    ])
    // Only show tasks that are "doing" (in progress) and not deleted/archived
    setTodos(
      todosData.filter(t => Number(t.deleted) === 0 && t.status === 'doing')
    )
    setCategories(categoriesData.filter(c => !c.deleted))
  }

  const handleWsUpdate = useCallback(() => {
    if (skipNextWsUpdate) {
      console.log('Skipping WebSocket update')
      setSkipNextWsUpdate(false)
      return
    }
    console.log('Processing WebSocket update')
    load()
  }, [skipNextWsUpdate])

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const ws = new WSClient(handleWsUpdate)
    return () => ws.stop()
  }, [handleWsUpdate])

  // Helper function to check if a todo is overdue
  const isOverdue = (dueAt: string | null | undefined) => {
    if (!dueAt) return false
    const now = new Date()
    const due = new Date(dueAt)
    return due < now
  }

  // Helper function to get priority icon
  function getPriorityIcon(priority: number) {
    switch (priority) {
      case 0:
        return 'arrow-down'
      case 1:
        return 'minus'
      case 2:
        return 'arrow-up'
      case 3:
        return 'alert-circle'
      default:
        return 'minus'
    }
  }

  // Handle todo update from modal
  const handleTodoUpdate = (updatedTodo: Todo) => {
    setTodos(prev => prev.map(t => (t.id === updatedTodo.id ? updatedTodo : t)))
    setSelectedTodo(updatedTodo)
    // Skip next WebSocket update to prevent race condition
    setSkipNextWsUpdate(true)
    setTimeout(() => load(), 300)
  }

  // Handle todo delete from modal
  const handleTodoDelete = (todoId: string) => {
    setTodos(prev => prev.filter(t => t.id !== todoId))
    setSelectedTodo(null)
    // Skip next WebSocket update to prevent race condition
    setSkipNextWsUpdate(true)
    setTimeout(() => load(), 300)
  }

  // Toggle section collapse
  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  // Group todos by priority and due date for better organization
  const groupedTodos = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const overdue = todos.filter(t => t.due_at && new Date(t.due_at) < today)
    const todayTodos = todos.filter(t => {
      if (!t.due_at) return false
      const dueDate = new Date(t.due_at)
      const dueDateOnly = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate()
      )
      return dueDateOnly.getTime() === today.getTime()
    })
    const tomorrowTodos = todos.filter(t => {
      if (!t.due_at) return false
      const dueDate = new Date(t.due_at)
      const dueDateOnly = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate()
      )
      return dueDateOnly.getTime() === tomorrow.getTime()
    })
    const laterTodos = todos.filter(t => {
      if (!t.due_at) return true // Tasks without due date go to later
      const dueDate = new Date(t.due_at)
      const dueDateOnly = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate()
      )
      return dueDateOnly.getTime() > tomorrow.getTime()
    })

    // Sort each group by priority (high to low)
    const sortByPriority = (a: Todo, b: Todo) => b.priority - a.priority

    return {
      overdue: overdue.sort(sortByPriority),
      today: todayTodos.sort(sortByPriority),
      tomorrow: tomorrowTodos.sort(sortByPriority),
      later: laterTodos.sort(sortByPriority),
    }
  }, [todos])

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return null
    const category = categories.find(c => c.id === categoryId)
    return category?.name || null
  }

  const getCategoryColor = (categoryId: string | null | undefined) => {
    if (!categoryId) return '#6B7280'
    const category = categories.find(c => c.id === categoryId)
    return category?.color || '#6B7280'
  }

  const updateStatus = async (todoId: string, newStatus: string) => {
    try {
      setSkipNextWsUpdate(true)
      await api.updateStatus(todoId, newStatus)
      setTimeout(() => load(), 100)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const TodoCard = ({ todo }: { todo: Todo }) => (
    <div
      className={`card cursor-pointer ${
        isOverdue(todo.due_at) ? 'border-l-red-500' : ''
      }`}
      onClick={() => setSelectedTodo(todo)}
    >
      <div className="card-header">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="card-title">{todo.title}</h3>
            {getCategoryName(todo.category_id) && (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: getCategoryColor(todo.category_id),
                  }}
                />
                <span className="text-xs text-muted">
                  {getCategoryName(todo.category_id)}
                </span>
              </div>
            )}
            {todo.note && (
              <div className="mt-2 text-sm text-muted line-clamp-2">
                {todo.note.length > 100
                  ? `${todo.note.slice(0, 100)}...`
                  : todo.note}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`priority-badge priority-${todo.priority}`}>
              <Icon name={getPriorityIcon(todo.priority)} size={14} />
            </div>
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            {todo.due_at && (
              <>
                <Icon name="clock" size={14} />
                <span
                  className={
                    isOverdue(todo.due_at) ? 'text-red-600 font-medium' : ''
                  }
                >
                  {new Date(todo.due_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-success"
              onClick={e => {
                e.stopPropagation()
                updateStatus(todo.id, 'done')
              }}
            >
              <Icon name="check" size={14} />
              Done
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={e => {
                e.stopPropagation()
                updateStatus(todo.id, 'todo')
              }}
            >
              <Icon name="pause" size={14} />
              Pause
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const SectionHeader = ({
    title,
    count,
    icon,
    sectionId,
    isCollapsed,
  }: {
    title: string
    count: number
    icon: string
    sectionId: string
    isCollapsed: boolean
  }) => (
    <div
      className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-blue-50 hover:border-blue-200 rounded-lg p-3 -m-1 transition-all duration-200 border border-transparent"
      onClick={() => toggleSectionCollapse(sectionId)}
    >
      <div className="flex items-center gap-2">
        <Icon
          name="chevron-down"
          size={20}
          className={`text-gray-600 transition-transform duration-200 ${
            isCollapsed ? '-rotate-90' : 'rotate-0'
          }`}
        />
        <Icon name={icon} size={20} className="text-blue-600" />
      </div>
      <h2 className="text-lg font-semibold flex-1 text-gray-800">{title}</h2>
      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
        {count}
      </span>
    </div>
  )

  return (
    <div className="container">
      <div className="py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="sun" size={32} />
            <h1 className="text-2xl font-bold">My Day</h1>
          </div>
          <p className="text-muted">
            Focus on your active tasks. Items shown here are currently in
            progress.
          </p>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <p className="mt-2 text-muted">Loading your tasks...</p>
          </div>
        )}

        {!loading && todos.length === 0 && (
          <div className="text-center py-12">
            <Icon name="coffee" size={48} className="text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-muted">
              No tasks in progress. Go to the Admin panel to start working on
              something.
            </p>
          </div>
        )}

        {!loading && todos.length > 0 && (
          <div className="space-y-8">
            {/* Overdue Tasks */}
            {groupedTodos.overdue.length > 0 && (
              <section>
                <SectionHeader
                  title="Overdue"
                  count={groupedTodos.overdue.length}
                  icon="alert-triangle"
                  sectionId="overdue"
                  isCollapsed={collapsedSections.has('overdue')}
                />
                {!collapsedSections.has('overdue') && (
                  <div className="grid gap-4">
                    {groupedTodos.overdue.map(todo => (
                      <TodoCard key={todo.id} todo={todo} />
                    ))}
                  </div>
                )}
              </section>
            )}{' '}
            {/* Today's Tasks */}
            {groupedTodos.today.length > 0 && (
              <section>
                <SectionHeader
                  title="Due Today"
                  count={groupedTodos.today.length}
                  icon="calendar"
                  sectionId="today"
                  isCollapsed={collapsedSections.has('today')}
                />
                {!collapsedSections.has('today') && (
                  <div className="grid gap-4">
                    {groupedTodos.today.map(todo => (
                      <TodoCard key={todo.id} todo={todo} />
                    ))}
                  </div>
                )}
              </section>
            )}
            {/* Tomorrow's Tasks */}
            {groupedTodos.tomorrow.length > 0 && (
              <section>
                <SectionHeader
                  title="Due Tomorrow"
                  count={groupedTodos.tomorrow.length}
                  icon="sunrise"
                  sectionId="tomorrow"
                  isCollapsed={collapsedSections.has('tomorrow')}
                />
                {!collapsedSections.has('tomorrow') && (
                  <div className="grid gap-4">
                    {groupedTodos.tomorrow.map(todo => (
                      <TodoCard key={todo.id} todo={todo} />
                    ))}
                  </div>
                )}
              </section>
            )}
            {/* Later Tasks */}
            {groupedTodos.later.length > 0 && (
              <section>
                <SectionHeader
                  title="Later"
                  count={groupedTodos.later.length}
                  icon="calendar-days"
                  sectionId="later"
                  isCollapsed={collapsedSections.has('later')}
                />
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    collapsedSections.has('later')
                      ? 'max-h-0 opacity-0'
                      : 'max-h-[2000px] opacity-100'
                  }`}
                >
                  <div className="grid gap-4">
                    {groupedTodos.later.map(todo => (
                      <TodoCard key={todo.id} todo={todo} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

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
    </div>
  )
}
