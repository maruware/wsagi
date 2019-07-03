export class RoomSet {
  rooms: Map<string, Set<string>>

  constructor() {
    this.rooms = new Map()
  }

  joinRoom(id: string, roomName: string) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set())
    }

    this.rooms.get(roomName).add(id)
  }

  leaveRoom(id: string, roomName: string) {
    this.rooms.get(roomName).delete(id)
  }

  getRoomMembers(roomName: string) {
    if (this.rooms.has(roomName)) {
      return this.rooms.get(roomName).values()
    } else {
      return null
    }
  }
}
