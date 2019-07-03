import Redis from 'ioredis'

const WORKING = 'w'

const KEY_BASE = 'wsagi::msg::'

export class MessageStorage {
  client: Redis.Redis
  constructor(redisOptions?: Redis.RedisOptions) {
    this.client = new Redis(redisOptions)
  }

  add(id: string) {
    const key = this._genKey(id)
    return this.client.set(key, WORKING)
  }

  async isDone(id: string) {
    const key = this._genKey(id)
    const val = await this.client.get(key)
    return val === null
  }

  done(id: string) {
    const key = this._genKey(id)
    return this.client.del(key)
  }

  del(id: string) {
    const key = this._genKey(id)
    return this.client.del(key)
  }

  close() {
    this.client.disconnect()
  }

  async clear() {
    const pattern = `${KEY_BASE}*`

    const keys = await this.client.keys(pattern)
    if (keys.length > 0) {
      return this.client.del(...keys)
    }
    return false
  }

  async remainingMessages() {
    const pattern = `${KEY_BASE}*`
    const keys = await this.client.keys(pattern)
    return keys.map(key => {
      return key.replace(KEY_BASE, '')
    })
  }

  private _genKey(id: string) {
    return `${KEY_BASE}${id}`
  }
}
