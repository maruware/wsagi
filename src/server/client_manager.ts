import WebSocket from 'ws'
import uuid from 'uuid/v4'
import { logger } from '../logger'

export class ClientManager {
  clients: Map<string, WebSocket>

  constructor() {
    this.clients = new Map<string, WebSocket>()
  }

  add(client: WebSocket) {
    const id = this.generateId()
    this.clients.set(id, client)

    return id
  }

  remove(id: string) {
    this.clients.delete(id)
  }

  async send(id: string, data: WebSocket.Data) {
    if (!this.clients.has(id)) {
      throw new Error('Bad ID')
    }
    const client = this.clients.get(id)
    return new Promise((resolve, reject) => {
      logger.debug(`ws send ${data}`)
      client.send(data, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  allIds() {
    return this.clients.keys()
  }

  generateId() {
    return uuid()
  }
}
