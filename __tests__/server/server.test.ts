/* eslint-env jest */

import { WsagiServer } from '../../src/server'
import http from 'http'

describe('server test', () => {
  it('start should work', async () => {
    const port = 9999
    const server = new WsagiServer({ port }, { host: process.env.REDIS_HOST })

    await server.close()
  })

  it('external http server', async () => {
    const port = 9999
    const server = http.createServer()
    const wsServer = new WsagiServer(
      { server },
      { host: process.env.REDIS_HOST }
    )
    server.listen(port)

    await wsServer.close()
    server.close()
  })
})
