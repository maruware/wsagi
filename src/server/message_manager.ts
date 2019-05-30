import Redis from 'ioredis'

const WORKING = 'w'

export class MessageManager {
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

  _genKey(id: string) {
    return `wsagi::msg::${id}`
  }
}
