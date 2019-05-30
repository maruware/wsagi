/* eslint-env jest */

import { WsagiServer } from '../src/server'
import { WsagiClient } from '../src/client'
import { delay } from '@maruware/promise-tools'

describe('integrate test', () => {
  it('server -> client', async () => {
    const port = 9998
    const server = new WsagiServer({ port }, { host: process.env.REDIS_HOST })
    const event = 'event1'

    const client = new WsagiClient(`ws://localhost:${port}/`)
    const connected = jest.fn()
    client.on('open', connected)

    await client.waitReady()

    expect(connected.mock.calls.length).toBe(1)

    const received = jest.fn()
    client.on(event, received)
    const data = { val: 1 }
    await server.broadcast(event, data)

    await delay(100)

    expect(received.mock.calls.length).toBe(1)

    const cnt = await server.remainingSendCount()
    expect(cnt).toBe(0)

    await server.close()
  })
})
