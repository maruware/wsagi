import { RequestMessage } from '../../src/common/message'
import { WsagiClient } from '../../src/client'

export class TesterClient extends WsagiClient {
  respondable: boolean
  constructor(address: string, respondable: boolean) {
    super(address)
    this.respondable = respondable
  }

  protected handleRequest(msg: RequestMessage) {
    if (this.respondable) {
      // Response
      return super.handleRequest(msg)
    } else {
      this.emit(msg.event, msg.data)
      return Promise.resolve()
    }
  }
}
