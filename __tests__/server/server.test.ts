/* eslint-env jest */

import { WsagiServer } from '../../src/server'
import http from 'http'
import { TesterClient } from './tester_client'
import { delay } from '@maruware/promise-tools'

const port = 9999

describe('server test', () => {
  it('start should work', async () => {
    const server = new WsagiServer({ port }, { host: process.env.REDIS_HOST })

    await server.close()
  })

  it('external http server', async () => {
    const server = http.createServer()
    const wsServer = new WsagiServer(
      { server },
      { host: process.env.REDIS_HOST }
    )
    server.listen(port)

    await wsServer.close()
    server.close()
  })

  it('messages should remain if client is dead', async () => {
    const server = new WsagiServer(
      { port },
      { host: process.env.REDIS_HOST },
      { attempts: 3, backoff: 10 }
    )
    await server.clearRemainingSends()

    const event = 'event1'

    const resClient = new TesterClient(`ws://localhost:${port}/`, true)
    await resClient.waitReady()

    const noResClient = new TesterClient(`ws://localhost:${port}/`, false)
    await noResClient.waitReady()

    const receivedRes = jest.fn()
    resClient.on(event, receivedRes)

    const receivedNoRes = jest.fn()
    noResClient.on(event, receivedNoRes)

    await delay(10)

    const data = { val: 1 }
    await server.broadcast(event, data)

    await delay(50)

    expect(receivedRes.mock.calls.length).toBe(1)
    expect(receivedNoRes.mock.calls.length).toBeGreaterThan(1)

    const cnt = await server.remainingSendCount()
    expect(cnt).toBe(1)

    await resClient.close()
    await noResClient.close()
    await server.clearRemainingSends()
    await server.close()
  })
})
