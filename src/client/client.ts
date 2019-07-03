import WebSocket from 'ws'
import {
  decodeMessage,
  Message,
  encodeMessage,
  MessageKind,
  RequestMessage,
  ListenEventMessage,
  ResponseMessage
} from '../common/message'
import { EventEmitter2, Listener } from 'eventemitter2'
import { ulid } from 'ulid'
import { defer, Deferred } from '@maruware/promise-tools'
import { logger } from '../logger'

export class WsagiClient extends EventEmitter2 {
  instance: WebSocket
  deferredReady: Deferred<void>
  lastReceivedMessageId: string

  constructor(address: string) {
    super()
    this.instance = new WebSocket(address)
    this.deferredReady = defer<void>()

    this.lastReceivedMessageId = ''

    this.handleOpen = this.handleOpen.bind(this)
    this.handleClose = this.handleClose.bind(this)
    this.handleMessage = this.handleMessage.bind(this)

    this.instance.on('open', this.handleOpen)
    this.instance.on('close', this.handleClose)
    this.instance.on('message', this.handleMessage)
  }

  private handleOpen() {
    this.deferredReady.resolve()
    this.emit('open')
  }
  private handleClose() {
    this.emit('close')
  }
  protected handleMessage(data: WebSocket.Data) {
    const msg = decodeMessage(data)
    switch (msg.kind) {
      case MessageKind.Response:
        // TODO: nop current
        return Promise.resolve()
      case MessageKind.Request:
        return this.handleRequest(msg as RequestMessage)
      default:
        logger.error(`Unknown message kind ${msg.kind}`)
        return Promise.resolve()
    }
  }

  protected async handleRequest(msg: RequestMessage) {
    if (
      this.lastReceivedMessageId !== '' &&
      this.lastReceivedMessageId >= msg.id
    ) {
      logger.info('no op because already received message')
      return
    }
    this.emit(msg.event, msg.data)
    // Response
    await this.responseRequest(msg)
    this.lastReceivedMessageId = msg.id
  }

  protected responseRequest(msg: RequestMessage) {
    const res: ResponseMessage = {
      kind: MessageKind.Response,
      reqId: msg.id,
      event: msg.event
    }
    return this._send(res)
  }

  public send(event: string, data: any) {
    const msg: RequestMessage = {
      kind: MessageKind.Request,
      id: this.generateMessageId(),
      event,
      data
    }
    return this._send(msg)
  }

  public waitReady() {
    return this.deferredReady.promise
  }

  public on(event: string, listener: Listener): this {
    if (event !== 'open' && event !== 'close') {
      const msg: ListenEventMessage = {
        event,
        kind: MessageKind.ListenEvent
      }
      logger.debug(`send listen event message [${event}]`)
      this._send(msg)
    }

    return super.on(event, listener)
  }

  private _send(msg: Message) {
    const d = encodeMessage(msg)

    return new Promise<void>((resolve, reject) => {
      this.instance.send(d, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  private generateMessageId() {
    return ulid()
  }
}
