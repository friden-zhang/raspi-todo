import { API_BASE } from './api'
export type WSHandler = (ev: MessageEvent<any>) => void

export class WSClient {
  private url: string
  private ws?: WebSocket
  private handler?: WSHandler
  private retry = 1000
  private stopped = false

  constructor(handler: WSHandler) {
    const u = new URL(API_BASE)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws/updates'
    this.url = u.toString()
    this.handler = handler
    this.connect()
  }

  private connect() {
    if (this.stopped) return
    this.ws = new WebSocket(this.url)
    this.ws.onopen = () => {
      this.retry = 1000
      this.ws?.send('ping') // simple heartbeat
    }
    this.ws.onmessage = ev => this.handler?.(ev)
    this.ws.onclose = () => this.reconnect()
    this.ws.onerror = () => this.reconnect()
  }

  private reconnect() {
    if (this.stopped) return
    setTimeout(() => this.connect(), this.retry)
    this.retry = Math.min(this.retry * 2, 10_000)
  }

  stop() {
    this.stopped = true
    this.ws?.close()
  }
}
