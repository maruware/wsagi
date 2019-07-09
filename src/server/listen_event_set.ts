import Redis from 'ioredis'

const KEY_BASE = 'wsagi::listen_event::'

export class ListenEventStore {
  redis: Redis.Redis

  constructor(options?: Redis.RedisOptions) {
    this.redis = new Redis(options)
  }

  add(id: string, event: string) {
    const key = this.getKey(id)
    this.redis.sadd(key, event)
  }

  remove(id: string, event: string) {
    const key = this.getKey(id)
    this.redis.srem(key, event)
  }

  removeAll(id: string) {
    const key = this.getKey(id)
    return this.redis.del(key)
  }

  getListenEvents(id: string): Promise<string[]> {
    const key = this.getKey(id)
    return this.redis.smembers(key)
  }

  async hasListenEvent(id: string, event: string) {
    const key = this.getKey(id)
    const r = await this.redis.sismember(key, event)
    // 0 or 1 -> bool
    return Boolean(r)
  }

  close() {
    this.redis.disconnect()
  }

  async clear() {
    const ids = await this.redis.keys(KEY_BASE + '*')
    if (ids.length > 0) {
      await this.redis.del(...ids)
    }
  }

  private getKey(id: string) {
    return KEY_BASE + id
  }
}
