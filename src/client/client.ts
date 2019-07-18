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

export declare interface WsagiClient {
  on(event: 'open', listener: () => void): this
  on(event: 'close', listener: () => void): this
  on(event: 'reconnect', listener: () => void): this
  on(event: string, listener: Function): this
}

interface Headers {
  [key: string]: string
}

export interface WsagiClientOptions {
  headers?: Headers
  autoReconnectInterval?: number
}

export class WsagiClient extends EventEmitter2 {
  address: string
  instance: WebSocket
  deferredReady: Deferred<void>
  lastReceivedMessageId: string

  autoReconnectInterval: number
  headers: Headers

  constructor(address: string, options?: WsagiClientOptions) {
    super()
    this.address = address
    this.autoReconnectInterval = 5000
    if (options && options.autoReconnectInterval) {
      this.autoReconnectInterval = options.autoReconnectInterval
    }
    if (options && options.headers) {
      this.headers = options.headers
    }

    this.lastReceivedMessageId = ''

    this.handleOpen = this.handleOpen.bind(this)
    this.handleClose = this.handleClose.bind(this)
    this.handleMessage = this.handleMessage.bind(this)

    this.open()
  }

  private open() {
    this.deferredReady = defer<void>()
    const options: WebSocket.ClientOptions = {}
    if (this.headers) {
      options.headers = this.headers
    }
    this.instance = new WebSocket(this.address, options)

    this.instance.on('open', this.handleOpen)
    this.instance.on('close', this.handleClose)
    this.instance.on('message', this.handleMessage)

    logger.debug('opened')
  }

  public close() {
    this.instance.close()
  }

  private handleOpen() {
    this.deferredReady.resolve()
    this.emit('open')
  }
  private handleClose(code: number, reason: string) {
    logger.debug('handle close: code = %d, reason = %s', code, reason)

    switch (code) {
      case 1005:
        logger.info('socket closed')
        break
      default:
        this.reconnect()
    }
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
        logger.error('Unknown message kind : %s', msg.kind)
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
    if (!['open', 'close', 'reconnect'].includes(event)) {
      this.sendListenEventMessage(event)
    }

    return super.on(event, listener)
  }

  private reconnect() {
    this.instance.removeAllListeners()
    setTimeout(() => {
      logger.info('reconnecting...')
      try {
        this.open()
        this.emit('reconnect')
      } catch (e) {
        logger.error('failed to reconnect %s', e)
        this.reconnect()
      }
    }, this.autoReconnectInterval)
  }

  private _send(msg: Message) {
    const d = encodeMessage(msg)

    return new Promise<void>((resolve, reject) => {
      this.instance.send(d, err => {
        err ? reject(err) : resolve()
      })
    })
  }
  private async sendListenEventMessage(event: string) {
    await this.deferredReady.promise
    const msg: ListenEventMessage = {
      event,
      kind: MessageKind.ListenEvent
    }
    logger.debug('send listen event message [%s]', event)
    this._send(msg)
  }

  private generateMessageId() {
    return ulid()
  }
}
