import WebSocket from 'ws'
import uuid from 'uuid/v4'
import { logger } from '../logger'

export class SocketSet {
  sockets: Map<string, WebSocket>

  constructor() {
    this.sockets = new Map<string, WebSocket>()
  }

  add(client: WebSocket) {
    const id = this.generateId()
    this.sockets.set(id, client)

    return id
  }

  remove(id: string) {
    this.sockets.delete(id)
  }

  async send(id: string, data: WebSocket.Data) {
    if (!this.sockets.has(id)) {
      throw new Error('Bad ID')
    }
    const socket = this.sockets.get(id)
    return new Promise((resolve, reject) => {
      logger.debug(`ws send ${data}`)
      socket.send(data, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  allIds() {
    return this.sockets.keys()
  }

  generateId() {
    return uuid()
  }
}
