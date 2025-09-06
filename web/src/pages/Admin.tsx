import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Todo } from '../types'
import { WSClient } from '../ws'

export default function Admin() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    note: '',
    priority: 1,
    due_at: '',
  })
  const [statusFilter, setStatusFilter] = useState<string>('')

  async function load() {
    setLoading(true)
    try {
      const data = await api.listTodos(statusFilter || undefined)
      setTodos(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  useEffect(() => {
    const ws = new WSClient(() => load())
    return () => ws.stop()
  }, [])

  async function createTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    await api.createTodo({
      title: form.title.trim(),
      note: form.note || undefined,
      priority: (Number(form.priority) || 1) as 0 | 1 | 2 | 3,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : undefined,
    })
    setForm({ title: '', note: '', priority: 1, due_at: '' })
    await load()
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
      <h2>Admin Panel</h2>

      <form onSubmit={createTodo} className="toolbar" style={{ marginTop: 12 }}>
        <input
          className="input"
          placeholder="Title (required)"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
        />
        <input
          className="input"
          placeholder="Note (optional)"
          value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })}
        />
        <select
          className="input"
          value={form.priority}
          onChange={e =>
            setForm({ ...form, priority: Number(e.target.value) as any })
          }
        >
          <option value={0}>Priority 0 (lowest)</option>
          <option value={1}>Priority 1</option>
          <option value={2}>Priority 2</option>
          <option value={3}>Priority 3 (highest)</option>
        </select>
        <input
          className="input"
          type="datetime-local"
          value={form.due_at}
          onChange={e => setForm({ ...form, due_at: e.target.value })}
        />
        <button className="btn primary" type="submit">
          Create
        </button>
      </form>

      <div className="toolbar" style={{ marginTop: 8 }}>
        <label>Status filter:</label>
        <select
          className="input"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="todo">todo</option>
          <option value="doing">doing</option>
          <option value="done">done</option>
          <option value="archived">archived</option>
        </select>
        {loading && <span className="muted">Loading...</span>}
      </div>

      <h3 style={{ marginTop: 16 }}>Active / Not Archived</h3>
      <div className="grid">
        {grouped.active.map(t => (
          <TodoCard key={t.id} t={t} refresh={load} />
        ))}
      </div>

      {grouped.archived.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Archived</h3>
          <div className="grid">
            {grouped.archived.map(t => (
              <TodoCard key={t.id} t={t} refresh={load} />
            ))}
          </div>
        </>
      )}

      {grouped.deleted.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Deleted (Soft Delete)</h3>
          <div className="grid">
            {grouped.deleted.map(t => (
              <TodoCard key={t.id} t={t} refresh={load} deleted />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function fmtDue(due?: string | null) {
  if (!due) return '—'
  try {
    return new Date(due).toLocaleString()
  } catch {
    return due
  }
}

function TodoCard({
  t,
  refresh,
  deleted,
}: {
  t: Todo
  refresh: () => void
  deleted?: boolean
}) {
  async function setStatus(s: string) {
    await api.updateStatus(t.id, s)
    await refresh()
  }
  async function remove() {
    await api.deleteTodo(t.id)
    await refresh()
  }

  return (
    <div className={`card prio-${t.priority}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <span className={`pill ${t.status}`} style={{ marginRight: 8 }}>
            {t.status}
          </span>
          <strong>{t.title}</strong>
        </div>
        <div className="muted">Priority {t.priority}</div>
      </div>
      {t.note && (
        <div className="muted" style={{ marginTop: 6 }}>
          {t.note}
        </div>
      )}
      <div className="muted" style={{ marginTop: 6 }}>
        Due: {fmtDue(t.due_at)}
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: 'wrap' }}>
        {t.status !== 'todo' && (
          <button className="btn" onClick={() => setStatus('todo')}>
            Set to todo
          </button>
        )}
        {t.status !== 'doing' && (
          <button className="btn" onClick={() => setStatus('doing')}>
            Set to doing
          </button>
        )}
        {t.status !== 'done' && (
          <button className="btn" onClick={() => setStatus('done')}>
            Set to done
          </button>
        )}
        {t.status !== 'archived' && (
          <button className="btn" onClick={() => setStatus('archived')}>
            Archive
          </button>
        )}
        {!deleted && (
          <button className="btn danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
