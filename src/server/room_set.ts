import Redis from 'ioredis'

const KEY_BASE = 'wsagi::room::'

export class RoomSet {
  redis: Redis.Redis

  constructor(options?: Redis.RedisOptions) {
    this.redis = new Redis(options)
  }

  joinRoom(id: string, roomName: string) {
    const key = this.getRoomKey(roomName)
    this.redis.sadd(key, id)
  }

  leaveRoom(id: string, roomName: string) {
    const key = this.getRoomKey(roomName)
    this.redis.srem(key, id)
  }

  async getRoomMembers(roomName: string) {
    const key = this.getRoomKey(roomName)
    const members = (await this.redis.smembers(key)) as string[]
    return members
  }

  close() {
    this.redis.disconnect()
  }

  private getRoomKey(name: string) {
    return KEY_BASE + name
  }
}
