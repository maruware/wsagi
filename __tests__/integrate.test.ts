/* eslint-env jest */

import { WsagiServer } from '../src/server'
import { WsagiClient } from '../src/client'
import { delay } from '@maruware/promise-tools'

describe('integrate test', () => {
  it('server -> client', async () => {
    const port = 9998
    const server = new WsagiServer({
      port,
      redis: { host: process.env.REDIS_HOST }
    })
    await server.clearRemainingSends()

    const client = new WsagiClient(`ws://localhost:${port}/`)
    const connected = jest.fn()
    client.on('open', connected)

    await client.waitReady()

    expect(connected.mock.calls.length).toBe(1)

    const event1 = 'event1'
    const event2 = 'event2'
    const event3 = 'event3'

    const received = jest.fn()
    client.on(event1, received)
    client.on(event2, received)
    client.on(event3, received)

    await delay(10)

    // send one
    const id = server.getAllClientIds().next().value
    let data = { val: 1 }
    server.send(id, event1, data)

    await delay(100)
    expect(received.mock.calls.length).toBe(1)
    expect(received.mock.calls[0][0]).toEqual(data)

    // room
    const roomName = 'test-room'
    data = { val: 2 }

    server.join(id, roomName)
    server.sendRoom(roomName, event2, data)

    await delay(100)

    expect(received.mock.calls.length).toBe(2)
    expect(received.mock.calls[1][0]).toEqual(data)

    // broadcast
    data = { val: 3 }
    await server.broadcast(event3, data)

    await delay(100)

    expect(received.mock.calls.length).toBe(3)
    expect(received.mock.calls[2][0]).toEqual(data)

    const cnt = await server.remainingSendCount()
    expect(cnt).toBe(0)

    await client.close()
    await server.close()
  })

  it('reconnect', async () => {
    const port = 9998
    let server = new WsagiServer({
      port,
      redis: { host: process.env.REDIS_HOST }
    })
    const client = new WsagiClient(`ws://localhost:${port}/`, 5)
    const connected = jest.fn()
    client.on('open', connected)

    // dead server
    await server.close()
    // reboot
    server = new WsagiServer({
      port,
      redis: { host: process.env.REDIS_HOST }
    })

    await delay(10)

    expect(connected.mock.calls).toHaveLength(2)

    await client.close()
    await server.close()
  })
})
