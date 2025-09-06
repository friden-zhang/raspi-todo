import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { marked } from 'marked'
import { api } from '../api'
import type { Todo } from '../types'
import { WSClient } from '../ws'
import { Icon } from '../components/Icon'

export default function Admin() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [skipNextWsUpdate, setSkipNextWsUpdate] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    note: '',
    priority: 1,
    due_date: '',
    due_time: '',
  })

  // Generate default due date (today's date)
  const getDefaultDueDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [form, setForm] = useState({
    title: '',
    note: '',
    priority: 1,
    due_date: getDefaultDueDate(), // Default to today
    due_time: '18:00', // Default to 6 PM
  })
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Generate date options (next 30 days)
  const generateDateOptions = () => {
    const options = []
    const today = new Date()

    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)

      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      let label = ''
      if (i === 0) {
        label = `Today (${month}/${day})`
      } else if (i === 1) {
        label = `Tomorrow (${month}/${day})`
      } else if (i === 2) {
        label = `Day after tomorrow (${month}/${day})`
      } else {
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const weekday = weekdays[date.getDay()]
        label = `${weekday} (${month}/${day})`
      }

      options.push({ value: dateStr, label })
    }

    return options
  }

  // Generate time options
  const generateTimeOptions = () => {
    const options = []

    // Add special quick options
    options.push(
      { value: '09:00', label: '09:00 (Work start)' },
      { value: '12:00', label: '12:00 (Lunch)' },
      { value: '14:00', label: '14:00 (Afternoon)' },
      { value: '18:00', label: '18:00 (Work end)' },
      { value: '20:00', label: '20:00 (Evening)' },
      { value: '23:59', label: '23:59 (End of day)' }
    )

    // Add separator
    options.push({ value: '---', label: '--- Custom Time ---' })

    // Generate other time options
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')}`

        // Skip times already in quick options
        const isQuickOption = options.some(opt => opt.value === timeStr)
        if (!isQuickOption && timeStr !== '---') {
          options.push({ value: timeStr, label: timeStr })
        }
      }
    }

    return options
  }

  async function load() {
    setLoading(true)
    try {
      const data = await api.listTodos(statusFilter || undefined)
      setTodos(data)
    } finally {
      setLoading(false)
    }
  }

  const handleWsUpdate = useCallback(() => {
    if (skipNextWsUpdate) {
      console.log('Skipping WebSocket update')
      setSkipNextWsUpdate(false)
      return
    }
    console.log('Processing WebSocket update')
    load()
  }, [skipNextWsUpdate, statusFilter])

  useEffect(() => {
    load()
  }, [statusFilter])

  useEffect(() => {
    const ws = new WSClient(handleWsUpdate)
    return () => ws.stop()
  }, [handleWsUpdate]) // Use handleWsUpdate as dependency

  async function createTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    try {
      setLoading(true)

      // Combine date and time
      const dueDateTime =
        form.due_date && form.due_time
          ? new Date(`${form.due_date}T${form.due_time}`).toISOString()
          : null

      await api.createTodo({
        title: form.title.trim(),
        note: form.note || undefined,
        priority: (Number(form.priority) || 1) as 0 | 1 | 2 | 3,
        due_at: dueDateTime,
      })

      // Reset form first
      setForm({
        title: '',
        note: '',
        priority: 1,
        due_date: getDefaultDueDate(),
        due_time: '18:00',
      })

      // Let WebSocket handle the update instead of immediate reload
      // This prevents DOM conflicts during state transitions
      setTimeout(() => {
        load()
      }, 100)
    } catch (error) {
      console.error('Failed to create todo:', error)
      // You might want to show an error message to the user here
    } finally {
      setLoading(false)
    }
  }

  function startEdit(todo: Todo) {
    setEditingTodo(todo)
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
  }

  function cancelEdit() {
    setEditingTodo(null)
    setEditForm({
      title: '',
      note: '',
      priority: 1,
      due_date: '',
      due_time: '',
    })
  }

  async function saveEdit(e: React.FormEvent) {
    console.log('========== saveEdit function called ==========')
    e.preventDefault()
    console.log('preventDefault called')

    if (!editingTodo) {
      console.log('ERROR: No editing todo found')
      return
    }

    if (!editForm.title.trim()) {
      console.log('ERROR: Title is empty')
      return
    }

    console.log('Starting save process with data:', {
      id: editingTodo.id,
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
        id: editingTodo.id,
        title: editForm.title,
        note: editForm.note.trim() || null,
        priority: editForm.priority,
        due_at: dueDateTime,
      })

      const result = await api.updateTodo(editingTodo.id, {
        title: editForm.title,
        note: editForm.note.trim() || null,
        priority: editForm.priority as 0 | 1 | 2 | 3,
        due_at: dueDateTime,
      })

      console.log('API Update result:', result)

      // Skip next WebSocket update to prevent overriding our changes
      setSkipNextWsUpdate(true)

      cancelEdit()

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

  const grouped = useMemo(
    () => ({
      active: todos.filter(
        t => Number(t.deleted) === 0 && t.status !== 'archived'
      ),
      archived: todos.filter(
        t => t.status === 'archived' && Number(t.deleted) === 0
      ),
      deleted: todos.filter(t => Number(t.deleted) !== 0),
    }),
    [todos]
  )

  return (
    <div className="container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Icon name="settings" size={28} />
          Admin Panel
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>Total: {todos.length}</span>
          <span>•</span>
          <span>Active: {grouped.active.length}</span>
          <span>•</span>
          <span>Archived: {grouped.archived.length}</span>
          {grouped.deleted.length > 0 && (
            <>
              <span>•</span>
              <span>Deleted: {grouped.deleted.length}</span>
            </>
          )}
        </div>
      </div>

      {/* Create Todo Form */}
      <div className="card mb-6">
        <h3 className="flex items-center gap-2 mb-4 font-semibold">
          <Icon name="plus-circle" size={20} />
          Create New Task
        </h3>
        <form onSubmit={createTodo}>
          <div className="form-row mb-4">
            <input
              className="input"
              placeholder="Task title (required)"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Note (optional)"
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="text-sm font-medium text-muted">Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={e =>
                  setForm({ ...form, priority: Number(e.target.value) as any })
                }
              >
                <option value={0}>Priority 0 (Lowest)</option>
                <option value={1}>Priority 1 (Normal)</option>
                <option value={2}>Priority 2 (Important)</option>
                <option value={3}>Priority 3 (Urgent)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="text-sm font-medium text-muted">Due Date</label>
              <select
                className="input"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              >
                {generateDateOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="text-sm font-medium text-muted">Due Time</label>
              <select
                className="input"
                value={form.due_time}
                onChange={e => setForm({ ...form, due_time: e.target.value })}
              >
                {generateTimeOptions().map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.value === '---'}
                    style={
                      option.value === '---'
                        ? {
                            fontStyle: 'italic',
                            color: '#999',
                            backgroundColor: '#f5f5f5',
                          }
                        : {}
                    }
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="text-sm font-medium text-muted">&nbsp;</label>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !form.title.trim()}
              >
                <Icon name="plus" size={16} />
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="flex items-center gap-4">
          <label className="font-medium">Status Filter:</label>
          <select
            className="input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">All Status</option>
            <option value="todo">Todo</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
          </select>
          {loading && <div className="loading">Loading...</div>}
        </div>
      </div>

      {/* Active Todos Section */}
      <div className="section-header">
        <h2 className="section-title">
          <Icon name="list-todo" size={20} />
          Active Tasks
        </h2>
        <span className="section-count">{grouped.active.length}</span>
      </div>

      {grouped.active.length === 0 ? (
        <div className="empty-state">
          <Icon name="inbox" className="empty-state-icon" size={48} />
          <h3 className="empty-state-title">No Active Tasks</h3>
          <p className="empty-state-description">
            Create your first task to start managing your todos
          </p>
        </div>
      ) : (
        <div className="grid">
          {grouped.active.map(t => (
            <TodoCard key={t.id} t={t} refresh={load} onEdit={startEdit} />
          ))}
        </div>
      )}

      {/* Archived Todos Section */}
      {grouped.archived.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">
              <Icon name="archive" size={20} />
              Archived Tasks
            </h2>
            <span className="section-count">{grouped.archived.length}</span>
          </div>
          <div className="grid">
            {grouped.archived.map(t => (
              <TodoCard key={t.id} t={t} refresh={load} onEdit={startEdit} />
            ))}
          </div>
        </>
      )}

      {/* Deleted Todos Section */}
      {grouped.deleted.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">
              <Icon name="trash-2" size={20} />
              Deleted Tasks
            </h2>
            <span className="section-count">{grouped.deleted.length}</span>
          </div>
          <div className="grid">
            {grouped.deleted.map(t => (
              <TodoCard key={t.id} t={t} refresh={load} deleted />
            ))}
          </div>
        </>
      )}

      {/* Edit Todo Modal */}
      {editingTodo && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="flex items-center gap-2 font-semibold">
                <Icon name="edit" size={20} />
                Edit Task
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={cancelEdit}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={saveEdit}>
              <div className="form-row mb-4">
                <input
                  className="input"
                  placeholder="Task title (required)"
                  value={editForm.title}
                  onChange={e =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-row mb-4">
                <textarea
                  className="textarea"
                  placeholder="Notes (supports Markdown: **bold**, *italic*, `code`, etc.)"
                  value={editForm.note}
                  onChange={e =>
                    setEditForm({ ...editForm, note: e.target.value })
                  }
                  rows={6}
                />
                <div className="text-sm text-muted mt-1">
                  Markdown preview will be shown in the task card
                </div>
              </div>

              <div className="form-row">
                <select
                  className="select"
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

                <input
                  type="date"
                  className="input"
                  value={editForm.due_date}
                  onChange={e =>
                    setEditForm({ ...editForm, due_date: e.target.value })
                  }
                  required
                />

                <input
                  type="time"
                  className="input"
                  value={editForm.due_time}
                  onChange={e =>
                    setEditForm({ ...editForm, due_time: e.target.value })
                  }
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelEdit}
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
          </div>
        </div>
      )}
    </div>
  )
}

function fmtDue(due?: string | null) {
  if (!due) return 'No due date set'
  try {
    const date = new Date(due)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) {
      return `Overdue by ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''}`
    } else if (days === 0) {
      return 'Due today'
    } else if (days === 1) {
      return 'Due tomorrow'
    } else if (days <= 7) {
      return `Due in ${days} day${days > 1 ? 's' : ''}`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  } catch {
    return due
  }
}

function getStatusInfo(status: string) {
  switch (status) {
    case 'todo':
      return { text: 'Todo', icon: 'circle' }
    case 'doing':
      return { text: 'Doing', icon: 'clock' }
    case 'done':
      return { text: 'Done', icon: 'check-circle' }
    case 'archived':
      return { text: 'Archived', icon: 'archive' }
    default:
      return { text: status, icon: 'help-circle' }
  }
}

function getPriorityInfo(priority: number) {
  switch (priority) {
    case 0:
      return { text: 'Low', icon: 'arrow-down' }
    case 1:
      return { text: 'Normal', icon: 'minus' }
    case 2:
      return { text: 'Important', icon: 'arrow-up' }
    case 3:
      return { text: 'Urgent', icon: 'alert-circle' }
    default:
      return { text: 'Normal', icon: 'minus' }
  }
}

function TodoCard({
  t,
  refresh,
  deleted,
  onEdit,
}: {
  t: Todo
  refresh: () => void
  deleted?: boolean
  onEdit?: (todo: Todo) => void
}) {
  const statusInfo = getStatusInfo(t.status)
  const priorityInfo = getPriorityInfo(t.priority)

  async function setStatus(s: string) {
    await api.updateStatus(t.id, s)
    await refresh()
  }

  async function remove() {
    await api.deleteTodo(t.id)
    await refresh()
  }

  useEffect(() => {
    // @ts-ignore
    if (window.lucide) {
      // @ts-ignore
      window.lucide.createIcons()
    }
  })

  const isOverdue =
    t.due_at && new Date(t.due_at) < new Date() && t.status !== 'done'

  return (
    <div
      className={`card priority-${t.priority} ${deleted ? 'opacity-60' : ''}`}
    >
      <div className="priority-indicator"></div>

      <div className="card-header">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className={`status-pill ${t.status}`}>
              <Icon name={statusInfo.icon} size={12} />
              {statusInfo.text}
            </span>
            <span className={`priority-badge priority-${t.priority}`}>
              <Icon name={priorityInfo.icon} size={12} />
              {priorityInfo.text}
            </span>
          </div>
          <h3 className="card-title">{t.title}</h3>
        </div>
      </div>

      {t.note && (
        <div className="card-content">
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={{
              __html: marked.parse(t.note, { breaks: true, gfm: true }),
            }}
          />
        </div>
      )}

      <div
        className={`flex items-center gap-2 mb-4 text-sm ${
          isOverdue ? 'text-red-600' : 'text-muted'
        }`}
      >
        <Icon name={isOverdue ? 'alert-triangle' : 'calendar'} size={14} />
        <span>{fmtDue(t.due_at)}</span>
      </div>

      <div className="card-footer">
        {!deleted && (
          <>
            {t.status !== 'todo' && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setStatus('todo')}
              >
                <Icon name="rotate-ccw" size={14} />
                Todo
              </button>
            )}
            {t.status !== 'doing' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setStatus('doing')}
              >
                <Icon name="play" size={14} />
                Start
              </button>
            )}
            {t.status !== 'done' && (
              <button
                className="btn btn-sm btn-success"
                onClick={() => setStatus('done')}
              >
                <Icon name="check" size={14} />
                Done
              </button>
            )}
            {t.status !== 'archived' && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setStatus('archived')}
              >
                <Icon name="archive" size={14} />
                Archive
              </button>
            )}
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onEdit?.(t)}
            >
              <Icon name="edit" size={14} />
              Edit
            </button>
            <button className="btn btn-sm btn-danger" onClick={remove}>
              <Icon name="trash-2" size={14} />
              Delete
            </button>
          </>
        )}
        {deleted && (
          <div className="text-sm text-muted flex items-center gap-2">
            <Icon name="trash" size={14} />
            Deleted task
          </div>
        )}
      </div>
    </div>
  )
}
