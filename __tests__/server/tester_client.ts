import { Message } from '../../src/common/message'
import { WsagiClient } from '../../src/client'

export class TesterClient extends WsagiClient {
  respondable: boolean
  constructor(address: string, respondable: boolean) {
    super(address)
    this.respondable = respondable
  }

  protected handleRequest(msg: Message) {
    this.emit(msg.event, msg.data)
    if (this.respondable) {
      // Response
      return this.responseRequest(msg)
    } else {
      return Promise.resolve()
    }
  }
}
