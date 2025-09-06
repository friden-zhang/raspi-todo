import React, { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import type { Todo } from '../types'
import { WSClient } from '../ws'

export default function Display() {
  const [todos, setTodos] = useState<Todo[]>([])

  async function load() {
    const data = await api.listTodos()
    setTodos(
      data.filter(t => Number(t.deleted) === 0 && t.status !== 'archived')
    )
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const ws = new WSClient(() => load())
    return () => ws.stop()
  }, [])

  // Initialize icons when component updates
  useEffect(() => {
    // @ts-ignore
    if (window.lucide) {
      // @ts-ignore
      window.lucide.createIcons()
    }
  })

  // Group todos by status
  const todosByStatus = useMemo(() => {
    const groups = {
      todo: todos.filter(t => t.status === 'todo'),
      doing: todos.filter(t => t.status === 'doing'),
      done: todos.filter(t => t.status === 'done'),
    }
    return groups
  }, [todos])

  function formatDueDate(due?: string | null) {
    if (!due) return null
    try {
      const date = new Date(due)
      const now = new Date()
      const diff = date.getTime() - now.getTime()
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

      if (days < 0) {
        return {
          text: `Overdue by ${Math.abs(days)} day${
            Math.abs(days) > 1 ? 's' : ''
          }`,
          isOverdue: true,
        }
      } else if (days === 0) {
        return { text: 'Due today', isOverdue: false }
      } else if (days === 1) {
        return { text: 'Due tomorrow', isOverdue: false }
      } else if (days <= 7) {
        return {
          text: `Due in ${days} day${days > 1 ? 's' : ''}`,
          isOverdue: false,
        }
      } else {
        return {
          text: date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
          }),
          isOverdue: false,
        }
      }
    } catch {
      return null
    }
  }

  function getStatusConfig(status: string) {
    switch (status) {
      case 'todo':
        return {
          title: 'Todo',
          icon: 'circle',
          color: 'warning',
          bgColor: 'var(--warning-50)',
          borderColor: 'var(--warning-200)',
        }
      case 'doing':
        return {
          title: 'In Progress',
          icon: 'clock',
          color: 'primary',
          bgColor: 'var(--primary-50)',
          borderColor: 'var(--primary-200)',
        }
      case 'done':
        return {
          title: 'Completed',
          icon: 'check-circle',
          color: 'success',
          bgColor: 'var(--success-50)',
          borderColor: 'var(--success-200)',
        }
      default:
        return {
          title: status,
          icon: 'help-circle',
          color: 'gray',
          bgColor: 'var(--gray-50)',
          borderColor: 'var(--gray-200)',
        }
    }
  }

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

  return (
    <div className="container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <i data-lucide="monitor" style={{ width: 28, height: 28 }}></i>
          Board View
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            Todo: {todosByStatus.todo.length}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            In Progress: {todosByStatus.doing.length}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            Completed: {todosByStatus.done.length}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {(['todo', 'doing', 'done'] as const).map(status => {
          const config = getStatusConfig(status)
          const statusTodos = todosByStatus[status]

          return (
            <div key={status} className="flex flex-col">
              {/* Column Header */}
              <div
                className="p-4 rounded-lg mb-4 border-2"
                style={{
                  backgroundColor: config.bgColor,
                  borderColor: config.borderColor,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i
                      data-lucide={config.icon}
                      style={{ width: 18, height: 18 }}
                    ></i>
                    <h2 className="font-semibold">{config.title}</h2>
                  </div>
                  <span className="bg-white px-2 py-1 rounded-full text-sm font-medium">
                    {statusTodos.length}
                  </span>
                </div>
              </div>

              {/* Column Cards */}
              <div className="flex flex-col gap-4">
                {statusTodos.length === 0 ? (
                  <div className="p-6 text-center text-muted border-2 border-dashed border-gray-200 rounded-lg">
                    <i
                      data-lucide="inbox"
                      style={{ width: 32, height: 32, margin: '0 auto 8px' }}
                    ></i>
                    <p className="text-sm">No {config.title.toLowerCase()}</p>
                  </div>
                ) : (
                  statusTodos.map(todo => {
                    const dueInfo = formatDueDate(todo.due_at)
                    return (
                      <div
                        key={todo.id}
                        className={`card priority-${todo.priority}`}
                      >
                        <div className="priority-indicator"></div>

                        <div className="card-header">
                          <h3 className="card-title">{todo.title}</h3>
                          <div
                            className={`priority-badge priority-${todo.priority}`}
                          >
                            <i
                              data-lucide={getPriorityIcon(todo.priority)}
                              style={{ width: 12, height: 12 }}
                            ></i>
                          </div>
                        </div>

                        {todo.note && (
                          <div className="card-content">
                            <p className="text-sm">{todo.note}</p>
                          </div>
                        )}

                        {dueInfo && (
                          <div
                            className={`flex items-center gap-2 text-xs ${
                              dueInfo.isOverdue ? 'text-red-600' : 'text-muted'
                            }`}
                          >
                            <i
                              data-lucide={
                                dueInfo.isOverdue
                                  ? 'alert-triangle'
                                  : 'calendar'
                              }
                              style={{ width: 12, height: 12 }}
                            ></i>
                            <span>{dueInfo.text}</span>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {todos.length === 0 && (
        <div className="empty-state">
          <i data-lucide="clipboard-list" className="empty-state-icon"></i>
          <h3 className="empty-state-title">No tasks yet</h3>
          <p className="empty-state-description">
            Go to the admin panel to create your first task
          </p>
        </div>
      )}
    </div>
  )
}
