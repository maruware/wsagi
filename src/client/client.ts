import WebSocket from 'ws'
import { decodeMessage, Message, encodeMessage } from '../common/message'
import { EventEmitter2 } from 'eventemitter2'
import uuid from 'uuid/v4'
import { defer, Deferred } from '@maruware/promise-tools'

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
  private handleMessage(data: WebSocket.Data) {
    const msg = decodeMessage(data)
    if (msg.isResponse) {
      // TODO: nop current
      return Promise.resolve()
    } else {
      return this.handleRequest(msg)
    }
  }

  private handleRequest(msg: Message) {
    this.emit(msg.event, msg.data)
    // Response
    return this.responseRequest(msg)
  }

  private responseRequest(msg: Message) {
    const res: Message = {
      isResponse: true,
      id: msg.id,
      event: msg.event
    }
    return this._send(res)
  }

  public send(event: string, data: any) {
    const msg: Message = {
      event,
      data,
      id: this.generateMessageId(),
      isResponse: false
    }
    return this._send(msg)
  }

  public waitReady() {
    return this.deferredReady.promise
  }

  private _send(msg: Message) {
    const d = encodeMessage(msg)

    return new Promise((resolve, reject) => {
      this.socket.send(d, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  private generateMessageId() {
    return uuid()
  }
}
