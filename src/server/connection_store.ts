import WebSocket from 'ws'
import uuid from 'uuid/v4'
import { logger } from '../logger'
import Redis from 'ioredis'

const CHANNEL = 'wsagi::conn'

export class ConnectionStore {
  connections: Map<string, WebSocket>
  sub: Redis.Redis
  pub: Redis.Redis

  constructor(options?: Redis.RedisOptions) {
    this.connections = new Map<string, WebSocket>()

    this.sub = new Redis(options)
    this.pub = new Redis(options)

    this.sub.subscribe(CHANNEL)
    this.handleMessage = this.handleMessage.bind(this)
    this.sub.on('message', this.handleMessage)
  }

  handleMessage(channel: string, message: string) {
    logger.debug('handleMessage: channel=%s message=%s', channel, message)
    if (channel !== CHANNEL) {
      throw new Error('Received unexpected channel')
    }
    const { id, data } = this.decodeRedisMessage(message)
    if (this.hasConnection(id)) {
      this.sendProc(id, data)
    }
  }

  add(client: WebSocket) {
    const id = this.generateId()
    this.connections.set(id, client)

    return id
  }

  remove(id: string) {
    this.connections.delete(id)
  }

  async send(id: string, data: string) {
    const m = this.encodeRedisMessage(id, data)
    await this.pub.publish(CHANNEL, m)
  }

  allIds() {
    return this.connections.keys()
  }

  close() {
    this.sub.disconnect()
    this.pub.disconnect()
  }

  private hasConnection(id: string) {
    return this.connections.has(id)
  }

  private async sendProc(id: string, data: string) {
    if (!this.connections.has(id)) {
      throw new Error('Bad ID')
    }
    const socket = this.connections.get(id)
    return new Promise((resolve, reject) => {
      logger.debug(`ws send ${data}`)
      socket.send(data, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  private generateId() {
    return uuid()
  }

  private encodeRedisMessage(id: string, data: string) {
    return JSON.stringify({ id, data })
  }

  private decodeRedisMessage(msg: string) {
    return JSON.parse(msg) as { id: string; data: string }
  }
}
