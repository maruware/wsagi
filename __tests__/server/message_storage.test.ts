/* eslint-env jest */

import { MessageStorage } from '../../src/server/message_storage'

describe('message manager test', () => {
  it('simple scenario', async () => {
    const m = new MessageStorage({ host: process.env.REDIS_HOST })
    const id1 = 'a'
    await m.add(id1)

    const id2 = 'b'
    await m.add(id2)

    let isDone = await m.isDone(id1)
    expect(isDone).toBe(false)

    await m.done(id1)
    isDone = await m.isDone(id1)
    expect(isDone).toBe(true)

    isDone = await m.isDone(id2)
    expect(isDone).toBe(false)

    await m.done(id2)

    m.close()
  })
})
