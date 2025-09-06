import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { marked } from 'marked'
import { api } from '../api'
import type { Todo } from '../types'
import { WSClient } from '../ws'
import { Icon } from '../components/Icon'

export default function Display() {
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
    setTodos(
      data.filter(t => Number(t.deleted) === 0 && t.status !== 'archived')
    )
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

  return (
    <div className="container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Icon name="monitor" size={28} />
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
                    <Icon name={config.icon} size={18} />
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
                    <Icon
                      name="inbox"
                      size={32}
                      style={{ margin: '0 auto 8px', display: 'block' }}
                    />
                    <p className="text-sm">No {config.title.toLowerCase()}</p>
                  </div>
                ) : (
                  statusTodos.map(todo => {
                    const dueInfo = formatDueDate(todo.due_at)
                    return (
                      <div
                        key={todo.id}
                        className={`card priority-${todo.priority}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleCardClick(todo)}
                      >
                        <div className="priority-indicator"></div>

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
                            className={`flex items-center gap-2 text-xs ${
                              dueInfo.isOverdue ? 'text-red-600' : 'text-muted'
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
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {todos.length === 0 && (
        <div className="empty-state">
          <Icon name="clipboard-list" className="empty-state-icon" size={48} />
          <h3 className="empty-state-title">No tasks yet</h3>
          <p className="empty-state-description">
            Go to the admin panel to create your first task
          </p>
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
                      <div className={`status-pill ${selectedTodo.status}`}>
                        <Icon
                          name={getStatusConfig(selectedTodo.status).icon}
                          size={12}
                        />
                        {getStatusConfig(selectedTodo.status).title}
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
                        <Icon name="calendar" size={14} />
                        <span>
                          {new Date(selectedTodo.due_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <div className="flex gap-2">
                    {selectedTodo.status !== 'todo' && (
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => updateStatus(selectedTodo, 'todo')}
                      >
                        <Icon name="rotate-ccw" size={14} />
                        Todo
                      </button>
                    )}
                    {selectedTodo.status !== 'doing' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => updateStatus(selectedTodo, 'doing')}
                      >
                        <Icon name="play" size={14} />
                        Start
                      </button>
                    )}
                    {selectedTodo.status !== 'done' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => updateStatus(selectedTodo, 'done')}
                      >
                        <Icon name="check" size={14} />
                        Complete
                      </button>
                    )}
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
