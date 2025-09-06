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

  // Initialize icons when component updates
  useEffect(() => {
    // @ts-ignore
    if (window.lucide) {
      // @ts-ignore
      window.lucide.createIcons()
    }
  })

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
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <i data-lucide="settings" style={{ width: 28, height: 28 }}></i>
          管理面板
        </h1>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>总计: {todos.length}</span>
          <span>•</span>
          <span>活跃: {grouped.active.length}</span>
          <span>•</span>
          <span>已归档: {grouped.archived.length}</span>
          {grouped.deleted.length > 0 && (
            <>
              <span>•</span>
              <span>已删除: {grouped.deleted.length}</span>
            </>
          )}
        </div>
      </div>

      {/* Create Todo Form */}
      <div className="card mb-6">
        <h3 className="flex items-center gap-2 mb-4 font-semibold">
          <i data-lucide="plus-circle" style={{ width: 20, height: 20 }}></i>
          创建新任务
        </h3>
        <form onSubmit={createTodo}>
          <div className="form-row mb-4">
            <input
              className="input"
              placeholder="任务标题 (必填)"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="备注 (可选)"
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <div className="form-row">
            <select
              className="input"
              value={form.priority}
              onChange={e =>
                setForm({ ...form, priority: Number(e.target.value) as any })
              }
            >
              <option value={0}>优先级 0 (最低)</option>
              <option value={1}>优先级 1 (普通)</option>
              <option value={2}>优先级 2 (重要)</option>
              <option value={3}>优先级 3 (紧急)</option>
            </select>
            <input
              className="input"
              type="datetime-local"
              value={form.due_at}
              onChange={e => setForm({ ...form, due_at: e.target.value })}
            />
            <button className="btn btn-primary" type="submit">
              <i data-lucide="plus" style={{ width: 16, height: 16 }}></i>
              创建任务
            </button>
          </div>
        </form>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="flex items-center gap-4">
          <label className="font-medium">状态筛选:</label>
          <select
            className="input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">全部状态</option>
            <option value="todo">待办</option>
            <option value="doing">进行中</option>
            <option value="done">已完成</option>
            <option value="archived">已归档</option>
          </select>
          {loading && <div className="loading">正在加载...</div>}
        </div>
      </div>

      {/* Active Todos Section */}
      <div className="section-header">
        <h2 className="section-title">
          <i data-lucide="list-todo" style={{ width: 20, height: 20 }}></i>
          活跃任务
        </h2>
        <span className="section-count">{grouped.active.length}</span>
      </div>

      {grouped.active.length === 0 ? (
        <div className="empty-state">
          <i data-lucide="inbox" className="empty-state-icon"></i>
          <h3 className="empty-state-title">暂无活跃任务</h3>
          <p className="empty-state-description">
            创建您的第一个任务来开始管理您的待办事项
          </p>
        </div>
      ) : (
        <div className="grid">
          {grouped.active.map(t => (
            <TodoCard key={t.id} t={t} refresh={load} />
          ))}
        </div>
      )}

      {/* Archived Todos Section */}
      {grouped.archived.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">
              <i data-lucide="archive" style={{ width: 20, height: 20 }}></i>
              已归档任务
            </h2>
            <span className="section-count">{grouped.archived.length}</span>
          </div>
          <div className="grid">
            {grouped.archived.map(t => (
              <TodoCard key={t.id} t={t} refresh={load} />
            ))}
          </div>
        </>
      )}

      {/* Deleted Todos Section */}
      {grouped.deleted.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">
              <i data-lucide="trash-2" style={{ width: 20, height: 20 }}></i>
              已删除任务
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
    </div>
  )
}

function fmtDue(due?: string | null) {
  if (!due) return '未设置截止时间'
  try {
    const date = new Date(due)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) {
      return `已逾期 ${Math.abs(days)} 天`
    } else if (days === 0) {
      return '今天截止'
    } else if (days === 1) {
      return '明天截止'
    } else if (days <= 7) {
      return `${days} 天后截止`
    } else {
      return date.toLocaleDateString('zh-CN', {
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
      return { text: '待办', icon: 'circle' }
    case 'doing':
      return { text: '进行中', icon: 'clock' }
    case 'done':
      return { text: '已完成', icon: 'check-circle' }
    case 'archived':
      return { text: '已归档', icon: 'archive' }
    default:
      return { text: status, icon: 'help-circle' }
  }
}

function getPriorityInfo(priority: number) {
  switch (priority) {
    case 0:
      return { text: '低', icon: 'arrow-down' }
    case 1:
      return { text: '普通', icon: 'minus' }
    case 2:
      return { text: '重要', icon: 'arrow-up' }
    case 3:
      return { text: '紧急', icon: 'alert-circle' }
    default:
      return { text: '普通', icon: 'minus' }
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
              <i
                data-lucide={statusInfo.icon}
                style={{ width: 12, height: 12 }}
              ></i>
              {statusInfo.text}
            </span>
            <span className={`priority-badge priority-${t.priority}`}>
              <i
                data-lucide={priorityInfo.icon}
                style={{ width: 12, height: 12 }}
              ></i>
              {priorityInfo.text}
            </span>
          </div>
          <h3 className="card-title">{t.title}</h3>
        </div>
      </div>

      {t.note && (
        <div className="card-content">
          <p>{t.note}</p>
        </div>
      )}

      <div
        className={`flex items-center gap-2 mb-4 text-sm ${
          isOverdue ? 'text-red-600' : 'text-muted'
        }`}
      >
        <i
          data-lucide={isOverdue ? 'alert-triangle' : 'calendar'}
          style={{ width: 14, height: 14 }}
        ></i>
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
                <i
                  data-lucide="rotate-ccw"
                  style={{ width: 14, height: 14 }}
                ></i>
                待办
              </button>
            )}
            {t.status !== 'doing' && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setStatus('doing')}
              >
                <i data-lucide="play" style={{ width: 14, height: 14 }}></i>
                开始
              </button>
            )}
            {t.status !== 'done' && (
              <button
                className="btn btn-sm btn-success"
                onClick={() => setStatus('done')}
              >
                <i data-lucide="check" style={{ width: 14, height: 14 }}></i>
                完成
              </button>
            )}
            {t.status !== 'archived' && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setStatus('archived')}
              >
                <i data-lucide="archive" style={{ width: 14, height: 14 }}></i>
                归档
              </button>
            )}
            <button className="btn btn-sm btn-danger" onClick={remove}>
              <i data-lucide="trash-2" style={{ width: 14, height: 14 }}></i>
              删除
            </button>
          </>
        )}
        {deleted && (
          <div className="text-sm text-muted flex items-center gap-2">
            <i data-lucide="trash" style={{ width: 14, height: 14 }}></i>
            已删除的任务
          </div>
        )}
      </div>
    </div>
  )
}
