/* eslint-env jest */

import { RoomStore } from '../../src/server/room_store'

describe('room test', () => {
  it('simple scenario', async () => {
    const roomSet = new RoomStore({ host: process.env.REDIS_HOST })
    const roomName = 'room1'
    await roomSet.joinRoom('a', roomName)
    await roomSet.joinRoom('b', roomName)
    let members = await roomSet.getRoomMembers(roomName)
    expect(members).toHaveLength(2)

    await roomSet.leaveRoom('b', roomName)

    members = await roomSet.getRoomMembers(roomName)
    expect(members).toHaveLength(1)

    roomSet.close()
  })
})
