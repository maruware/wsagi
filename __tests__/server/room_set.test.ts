/* eslint-env jest */

import { RoomSet } from '../../src/server/room_set'

describe('room test', () => {
  it('simple scenario', async () => {
    const roomSet = new RoomSet({ host: process.env.REDIS_HOST })
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
