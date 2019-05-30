/* eslint-env jest */

import { WsagiServer } from '../src/server'

describe('server test', () => {
  it('start should work', async () => {
    const port = 9999
    const server = new WsagiServer({ port }, { host: process.env.REDIS_HOST })

    await server.close()
  })
})
