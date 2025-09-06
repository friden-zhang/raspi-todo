import React, { useEffect, useState } from 'react'
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

  return (
    <div className="container">
      <h2>TODO Board</h2>
      <div className="grid">
        {todos.map(t => (
          <div key={t.id} className={`card prio-${t.priority}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{t.title}</strong>
              <span className={`pill ${t.status}`}>{t.status}</span>
            </div>
            {t.note && (
              <div className="muted" style={{ marginTop: 6 }}>
                {t.note}
              </div>
            )}
            <div className="muted" style={{ marginTop: 6 }}>
              Due: {t.due_at ? new Date(t.due_at).toLocaleString() : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
