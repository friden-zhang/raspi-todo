import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { marked } from 'marked'
import { api } from '../api'
import type { Todo } from '../types'
import { WSClient } from '../ws'
import { Icon } from '../components/Icon'

export default function MyDay() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [loading, setLoading] = useState(false)
  const [skipNextWsUpdate, setSkipNextWsUpdate] = useState(false)
  const [isEditingInDetail, setIsEditingInDetail] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    note: '',
    priority: 1,
    due_date: '',
    due_time: '',
  })

  async function load() {
    const data = await api.listTodos()
    // Only show tasks that are "doing" (in progress) and not deleted/archived
    setTodos(data.filter(t => Number(t.deleted) === 0 && t.status === 'doing'))
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
    const dueDate = new Date(dueAt)
    return dueDate < now
  }

  // Group todos by priority, with overdue tasks at the top of each priority group
  const todosByPriority = useMemo(() => {
    const groups = {
      urgent: [] as Todo[],
      important: [] as Todo[],
      normal: [] as Todo[],
      low: [] as Todo[],
    }

    todos.forEach(todo => {
      const overdue = isOverdue(todo.due_at)
      switch (todo.priority) {
        case 3:
          groups.urgent.push(todo)
          break
        case 2:
          groups.important.push(todo)
          break
        case 1:
          groups.normal.push(todo)
          break
        case 0:
          groups.low.push(todo)
          break
      }
    })

    // Sort each group: overdue tasks first, then by due date
    Object.keys(groups).forEach(key => {
      const group = groups[key as keyof typeof groups]
      group.sort((a, b) => {
        const aOverdue = isOverdue(a.due_at)
        const bOverdue = isOverdue(b.due_at)

        // Overdue tasks come first
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1

        // If both are overdue or both are not overdue, sort by due date
        if (a.due_at && b.due_at) {
          return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
        }
        if (a.due_at && !b.due_at) return -1
        if (!a.due_at && b.due_at) return 1
        return 0
      })
    })

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

  function getPriorityConfig(priority: number) {
    switch (priority) {
      case 3:
        return {
          title: 'Urgent',
          icon: 'alert-circle',
          color: 'danger',
          bgColor: 'var(--danger-50)',
          borderColor: 'var(--danger-200)',
          textColor: 'var(--danger-700)',
        }
      case 2:
        return {
          title: 'Important',
          icon: 'arrow-up',
          color: 'warning',
          bgColor: 'var(--warning-50)',
          borderColor: 'var(--warning-200)',
          textColor: 'var(--warning-700)',
        }
      case 1:
        return {
          title: 'Normal',
          icon: 'minus',
          color: 'primary',
          bgColor: 'var(--primary-50)',
          borderColor: 'var(--primary-200)',
          textColor: 'var(--primary-700)',
        }
      case 0:
        return {
          title: 'Low',
          icon: 'arrow-down',
          color: 'gray',
          bgColor: 'var(--gray-50)',
          borderColor: 'var(--gray-200)',
          textColor: 'var(--gray-700)',
        }
      default:
        return {
          title: 'Normal',
          icon: 'minus',
          color: 'gray',
          bgColor: 'var(--gray-50)',
          borderColor: 'var(--gray-200)',
          textColor: 'var(--gray-700)',
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

  function handleCardClick(todo: Todo) {
    setSelectedTodo(todo)
    // Initialize edit form when opening detail modal
    const dueDate = todo.due_at ? new Date(todo.due_at) : new Date()
    const dueDateStr = dueDate.toISOString().split('T')[0]
    const dueTimeStr = dueDate.toTimeString().slice(0, 5)

    setEditForm({
      title: todo.title,
      note: todo.note || '',
      priority: todo.priority,
      due_date: dueDateStr,
      due_time: dueTimeStr,
    })
    setIsEditingInDetail(false)
  }

  function startEditInDetail() {
    setIsEditingInDetail(true)
  }

  function cancelEditInDetail() {
    if (selectedTodo) {
      // Reset form to original values
      const dueDate = selectedTodo.due_at
        ? new Date(selectedTodo.due_at)
        : new Date()
      const dueDateStr = dueDate.toISOString().split('T')[0]
      const dueTimeStr = dueDate.toTimeString().slice(0, 5)

      setEditForm({
        title: selectedTodo.title,
        note: selectedTodo.note || '',
        priority: selectedTodo.priority,
        due_date: dueDateStr,
        due_time: dueTimeStr,
      })
    }
    setIsEditingInDetail(false)
  }

  async function saveEditInDetail(e: React.FormEvent) {
    console.log('========== saveEditInDetail function called ==========')
    e.preventDefault()
    console.log('preventDefault called')

    if (!selectedTodo) {
      console.log('ERROR: No selected todo found')
      return
    }

    if (!editForm.title.trim()) {
      console.log('ERROR: Title is empty')
      return
    }

    console.log('Starting save process with data:', {
      id: selectedTodo.id,
      title: editForm.title,
      note: editForm.note,
      priority: editForm.priority,
      due_date: editForm.due_date,
      due_time: editForm.due_time,
    })

    setLoading(true)
    try {
      // Combine date and time with proper timezone format
      const dueDateTime = `${editForm.due_date}T${editForm.due_time}:00Z`

      console.log('Calling API with:', {
        id: selectedTodo.id,
        title: editForm.title,
        note: editForm.note.trim() || null,
        priority: editForm.priority,
        due_at: dueDateTime,
      })

      const result = await api.updateTodo(selectedTodo.id, {
        title: editForm.title,
        note: editForm.note.trim() || null,
        priority: editForm.priority as 0 | 1 | 2 | 3,
        due_at: dueDateTime,
      })

      console.log('API Update result:', result)

      // Update the selectedTodo with new data
      setSelectedTodo(result)
      setIsEditingInDetail(false)

      // Skip next WebSocket update to prevent overriding our changes
      setSkipNextWsUpdate(true)

      // Delay the reload to allow WebSocket update to propagate
      setTimeout(() => {
        console.log('Reloading after save...')
        load()
      }, 300)
    } catch (error) {
      console.error('Failed to update todo:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(todo: Todo, newStatus: string) {
    try {
      await api.updateStatus(todo.id, newStatus)
      // Skip next WebSocket update to prevent conflicts
      setSkipNextWsUpdate(true)
      setTimeout(() => {
        load()
      }, 300)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const totalTasks = todos.length
  const overdueTasks = todos.filter(todo => isOverdue(todo.due_at)).length

  return (
    <div className="container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Icon name="sun" size={28} />
          My Day
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            In Progress: {totalTasks}
          </div>
          {overdueTasks > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              Overdue: {overdueTasks}
            </div>
          )}
        </div>
      </div>

      {totalTasks === 0 ? (
        <div className="empty-state">
          <Icon name="coffee" className="empty-state-icon" size={48} />
          <h3 className="empty-state-title">No tasks in progress</h3>
          <p className="empty-state-description">
            Start working on some tasks to see them here
          </p>
        </div>
      ) : (
        /* Priority Columns */
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}
        >
          {(['urgent', 'important', 'normal', 'low'] as const).map(
            priorityKey => {
              const priority =
                priorityKey === 'urgent'
                  ? 3
                  : priorityKey === 'important'
                  ? 2
                  : priorityKey === 'normal'
                  ? 1
                  : 0
              const config = getPriorityConfig(priority)
              const priorityTodos = todosByPriority[priorityKey]

              // Only show columns that have tasks
              if (priorityTodos.length === 0) return null

              return (
                <div key={priorityKey} className="flex flex-col">
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
                        <Icon name={config.icon} size={18} />
                        <h2
                          className="font-semibold"
                          style={{ color: config.textColor }}
                        >
                          {config.title}
                        </h2>
                      </div>
                      <span className="bg-white px-2 py-1 rounded-full text-sm font-medium">
                        {priorityTodos.length}
                      </span>
                    </div>
                  </div>

                  {/* Column Cards */}
                  <div className="flex flex-col gap-4">
                    {priorityTodos.map(todo => {
                      const dueInfo = formatDueDate(todo.due_at)
                      const todoIsOverdue = isOverdue(todo.due_at)
                      return (
                        <div
                          key={todo.id}
                          className={`card priority-${todo.priority} ${
                            todoIsOverdue ? 'border-l-4 border-l-red-500' : ''
                          }`}
                          style={{
                            cursor: 'pointer',
                            position: 'relative',
                            backgroundColor: todoIsOverdue
                              ? 'var(--danger-50)'
                              : 'white',
                          }}
                          onClick={() => handleCardClick(todo)}
                        >
                          <div className="priority-indicator"></div>

                          {/* Overdue Badge */}
                          {todoIsOverdue && (
                            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                              OVERDUE
                            </div>
                          )}

                          <div className="card-header">
                            <h3 className="card-title">{todo.title}</h3>
                            <div
                              className={`priority-badge priority-${todo.priority}`}
                            >
                              <Icon
                                name={getPriorityIcon(todo.priority)}
                                size={12}
                              />
                            </div>
                          </div>

                          {todo.note && (
                            <div className="card-content">
                              <div
                                className="markdown-content text-sm"
                                dangerouslySetInnerHTML={{
                                  __html: marked.parse(todo.note, {
                                    breaks: true,
                                    gfm: true,
                                  }),
                                }}
                              />
                            </div>
                          )}

                          {dueInfo && (
                            <div
                              className={`flex items-center gap-2 text-xs mt-3 ${
                                dueInfo.isOverdue
                                  ? 'text-red-600 font-medium'
                                  : 'text-muted'
                              }`}
                            >
                              <Icon
                                name={
                                  dueInfo.isOverdue
                                    ? 'alert-triangle'
                                    : 'calendar'
                                }
                                size={12}
                              />
                              <span>{dueInfo.text}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTodo && (
        <div className="modal-overlay" onClick={() => setSelectedTodo(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2 font-semibold">
                <Icon name="eye" size={20} />
                Task Details
              </h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedTodo(null)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {isEditingInDetail ? (
              /* Edit Mode */
              <form onSubmit={saveEditInDetail}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Title:
                    </label>
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

                  <div className="grid grid-cols-3 gap-3">
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
                        <option value={0}>Low</option>
                        <option value={1}>Normal</option>
                        <option value={2}>Important</option>
                        <option value={3}>Urgent</option>
                      </select>
                    </div>

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
                    onClick={cancelEditInDetail}
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
              <>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-lg mb-2">
                      {selectedTodo.title}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-muted mb-4">
                      <div className="status-pill doing">
                        <Icon name="clock" size={12} />
                        In Progress
                      </div>
                      <div
                        className={`priority-badge priority-${selectedTodo.priority}`}
                      >
                        <Icon
                          name={getPriorityIcon(selectedTodo.priority)}
                          size={12}
                        />
                        {
                          ['Low', 'Normal', 'Important', 'Urgent'][
                            selectedTodo.priority
                          ]
                        }
                      </div>
                      {isOverdue(selectedTodo.due_at) && (
                        <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                          OVERDUE
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedTodo.note && (
                    <div>
                      <h5 className="font-medium mb-2">Notes:</h5>
                      <div
                        className="markdown-content p-3 bg-gray-50 rounded-lg"
                        dangerouslySetInnerHTML={{
                          __html: marked.parse(selectedTodo.note, {
                            breaks: true,
                            gfm: true,
                          }),
                        }}
                      />
                    </div>
                  )}

                  {selectedTodo.due_at && (
                    <div>
                      <h5 className="font-medium mb-2">Due Date:</h5>
                      <div className="flex items-center gap-2 text-sm">
                        <Icon
                          name={
                            isOverdue(selectedTodo.due_at)
                              ? 'alert-triangle'
                              : 'calendar'
                          }
                          size={14}
                        />
                        <span
                          className={
                            isOverdue(selectedTodo.due_at)
                              ? 'text-red-600 font-medium'
                              : ''
                          }
                        >
                          {new Date(selectedTodo.due_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <div className="flex gap-2">
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => updateStatus(selectedTodo, 'todo')}
                    >
                      <Icon name="rotate-ccw" size={14} />
                      Back to Todo
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => updateStatus(selectedTodo, 'done')}
                    >
                      <Icon name="check" size={14} />
                      Complete
                    </button>
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={startEditInDetail}
                  >
                    <Icon name="edit" size={14} />
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
