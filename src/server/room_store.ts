import Redis from 'ioredis'

const ROOM_KEY_BASE = 'wsagi::room::'
const ID_TO_ROOM_KEY_BASE = 'wsagi::id_room::'

export class RoomStore {
  redis: Redis.Redis

  constructor(options?: Redis.RedisOptions) {
    this.redis = new Redis(options)
  }

  joinRoom(id: string, roomName: string) {
    const key = this.getRoomKey(roomName)
    this.redis.sadd(key, id)
    const idKey = this.getIdToRoomKey(id)
    this.redis.sadd(idKey, roomName)
  }

  leaveRoom(id: string, roomName: string) {
    const key = this.getRoomKey(roomName)
    this.redis.srem(key, id)

    const idKey = this.getIdToRoomKey(id)
    this.redis.srem(idKey, roomName)
  }

  async leaveAllRooms(id: string) {
    const idKey = this.getIdToRoomKey(id)
    const rooms = (await this.redis.smembers(idKey)) as string[]
    rooms.map(room => {
      const key = this.getRoomKey(room)
      this.redis.srem(key, id)
    })
    await this.redis.del(idKey)
  }

  async getRoomMembers(roomName: string) {
    const key = this.getRoomKey(roomName)
    const members = (await this.redis.smembers(key)) as string[]
    return members
  }

  close() {
    this.redis.disconnect()
  }

  async clear() {
    const rooms = await this.redis.keys(ROOM_KEY_BASE + '*')
    if (rooms.length > 0) {
      await this.redis.del(...rooms)
    }

    const ids = await this.redis.keys(ID_TO_ROOM_KEY_BASE + '*')
    if (ids.length > 0) {
      await this.redis.del(...ids)
    }
  }

  private getIdToRoomKey(id: string) {
    return ID_TO_ROOM_KEY_BASE + id
  }

  private getRoomKey(name: string) {
    return ROOM_KEY_BASE + name
  }
}
