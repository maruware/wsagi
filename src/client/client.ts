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
import uuid from 'uuid/v4'
import { defer, Deferred } from '@maruware/promise-tools'
import { logger } from '../logger'

export class WsagiClient extends EventEmitter2 {
  socket: WebSocket
  deferredReady: Deferred<void>

  constructor(address: string) {
    super()
    this.socket = new WebSocket(address)
    this.deferredReady = defer<void>()

    this.handleOpen = this.handleOpen.bind(this)
    this.handleClose = this.handleClose.bind(this)
    this.handleMessage = this.handleMessage.bind(this)

    this.socket.on('open', this.handleOpen)
    this.socket.on('close', this.handleClose)
    this.socket.on('message', this.handleMessage)
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

  protected handleRequest(msg: RequestMessage) {
    this.emit(msg.event, msg.data)
    // Response
    return this.responseRequest(msg)
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
      this.socket.send(d, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  private generateMessageId() {
    return uuid()
  }
}
