/* eslint-env jest */

import { hello } from '../src/index'

describe('hello', () => {
  it('hello should work', () => {
    const r = hello()
    expect(r).toBe('hello')
  })
})
