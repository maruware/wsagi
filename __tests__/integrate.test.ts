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
    await server.clearAll()

    const roomName = 'test-room'
    server.on('connection', conn => {
      server.join(conn.id, roomName)
    })

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

    // room
    let data = { val: 2 }

    server.sendRoom(roomName, event2, data)

    await delay(100)

    expect(received.mock.calls.length).toBe(1)
    expect(received.mock.calls[0][0]).toEqual(data)

    // broadcast
    data = { val: 3 }
    await server.broadcast(event3, data)

    await delay(100)

    expect(received.mock.calls.length).toBe(2)
    expect(received.mock.calls[1][0]).toEqual(data)

    const cnt = await server.remainingSendingCount()
    expect(cnt).toBe(0)

    await client.close()
    await delay(10)

    await server.close()
  })

  it('reconnect', async () => {
    const port = 9995
    let server = new WsagiServer({
      port,
      redis: { host: process.env.REDIS_HOST }
    })
    await server.clearAll()

    const client = new WsagiClient(`ws://localhost:${port}/`, 20)
    const connected = jest.fn()
    client.on('open', connected)
    const reconnected = jest.fn()
    client.on('reconnect', reconnected)

    await client.waitReady()

    // dead server
    await server.close()
    await delay(10)

    // reboot
    server = new WsagiServer({
      port,
      redis: { host: process.env.REDIS_HOST }
    })

    await delay(20)

    expect(connected.mock.calls).toHaveLength(2)
    expect(reconnected.mock.calls).toHaveLength(1)

    await client.close()
    await delay(10)

    await server.close()
  })

  it('multi instances', async () => {
    const port1 = 9997
    const server1 = new WsagiServer({
      port: port1,
      redis: { host: process.env.REDIS_HOST }
    })
    await server1.clearAll()

    const port2 = 9998
    const server2 = new WsagiServer({
      port: port2,
      redis: { host: process.env.REDIS_HOST }
    })

    const client = new WsagiClient(`ws://localhost:${port1}/`)
    await client.waitReady()

    const event = 'test'
    const received = jest.fn()
    client.on(event, received)

    const data = { val: 1 }
    await server2.broadcast(event, data)

    await delay(100)

    expect(received.mock.calls.length).toBe(1)

    client.close()

    await delay(10)
    await server1.close()
    await server2.close()
  })

  it('client -> server', async () => {
    const port = 9998
    const server = new WsagiServer({
      port,
      redis: { host: process.env.REDIS_HOST }
    })
    await server.clearAll()

    const event1 = 'event1'
    const received = jest.fn()
    server.on('connection', conn => {
      conn.on(event1, received)
    })

    const client = new WsagiClient(`ws://localhost:${port}/`)
    const connected = jest.fn()
    client.on('open', connected)

    await client.waitReady()

    const data = { val: 1 }
    await client.send(event1, data)

    await delay(50)

    expect(received.mock.calls.length).toBe(1)
    expect(received.mock.calls[0][0]).toEqual(data)

    client.close()

    await delay(10)
    await server.close()
  })
})
