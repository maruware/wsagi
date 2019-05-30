import Redis from 'ioredis'

const FALSE = 'f'
const TRUE = 't'

export class MessageManager {
  client: Redis.Redis
  constructor(redisOptions?: Redis.RedisOptions) {
    this.client = new Redis(redisOptions)
  }

  add(id: string) {
    const key = this._genKey(id)
    return this.client.set(key, FALSE)
  }

  async isDone(id: string) {
    const key = this._genKey(id)
    const val = await this.client.get(key)
    return val === TRUE
  }

  done(id: string) {
    const key = this._genKey(id)
    return this.client.set(key, TRUE)
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
