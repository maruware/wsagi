import WebSocket from 'ws'

import {
  MessageKind,
  decodeMessage,
  ResponseMessage,
  RequestMessage,
  ListenEventMessage
} from '../common/message'
import { logger } from '../logger'
import { EventEmitter } from 'events'

export declare interface Conneciton {
  on(event: '__response__', listener: (msg: ResponseMessage) => void): this
  on(
    event: '__receive_listen_event__',
    listener: (msg: ListenEventMessage) => void
  ): this
  on(event: 'close', listener: () => void): this
  on(event: string, listener: Function): this
}

export class Conneciton extends EventEmitter {
  instance: WebSocket
  id: string

  constructor(id: string, conn: WebSocket) {
    super()
    this.handleMessage = this.handleMessage.bind(this)

    this.id = id
    this.instance = conn
    this.bindEvents()
  }

  send(data: any) {
    return new Promise((resolve, reject) => {
      this.instance.send(data, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  private bindEvents() {
    this.instance.on('message', this.handleMessage)
    this.instance.on('close', () => {
      this.emit('close')
    })
  }

  private handleMessage(data: WebSocket.Data) {
    const msg = decodeMessage(data)
    switch (msg.kind) {
      case MessageKind.Response:
        this.emit('__response__', msg as ResponseMessage)
        return
      case MessageKind.Request:
        return this.handleRequest(msg as RequestMessage)
      case MessageKind.ListenEvent:
        this.emit('__receive_listen_event__', msg as ListenEventMessage)
        return
      default:
        logger.error(`Unknown message kind ${msg.kind}`)
    }
  }

  private handleRequest(msg: RequestMessage) {
    this.emit(msg.event, msg.data)
  }
}
