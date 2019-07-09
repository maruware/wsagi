import WebSocket from 'ws'
import uuid from 'uuid/v4'
import { logger } from '../logger'
import Redis from 'ioredis'
import { Conneciton } from './conneciton'

const CHANNEL = 'wsagi::conn'
const ID_STORE_KEY = 'wsagi::conn::ids'

export class ConnectionStore {
  idStore: Redis.Redis
  connections: Map<string, Conneciton>
  sub: Redis.Redis
  pub: Redis.Redis

  constructor(options?: Redis.RedisOptions) {
    this.connections = new Map<string, Conneciton>()

    this.idStore = new Redis(options)
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
      this.sendProc(id, data).catch(err => logger.error(err))
    }
  }

  add(socket: WebSocket) {
    const id = this.generateId()
    this.idStore.sadd(ID_STORE_KEY, id)
    const conn = new Conneciton(id, socket)
    this.connections.set(id, conn)

    return conn
  }

  remove(id: string) {
    this.idStore.srem(ID_STORE_KEY, id)
    this.connections.delete(id)
  }

  async send(id: string, data: string) {
    const m = this.encodeRedisMessage(id, data)
    await this.pub.publish(CHANNEL, m)
  }

  allIds(): Promise<string[]> {
    return this.idStore.smembers(ID_STORE_KEY)
  }

  close() {
    this.idStore.disconnect()
    this.sub.disconnect()
    this.pub.disconnect()
  }

  private hasConnection(id: string) {
    return this.connections.has(id)
  }

  private async sendProc(id: string, data: string) {
    logger.debug('ConnectionStore.sendProc : id=%s data=%s', id, data)

    if (!this.connections.has(id)) {
      throw new Error('Bad ID')
    }
    const conn = this.connections.get(id)
    return conn.send(data)
  }

  clear() {
    return this.idStore.del(ID_STORE_KEY)
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
