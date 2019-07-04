import WebSocket from 'ws'
import {
  decodeMessage,
  encodeMessage,
  MessageKind,
  RequestMessage,
  ResponseMessage,
  ListenEventMessage
} from '../common/message'
import { EventEmitter2 } from 'eventemitter2'
import { ConnectionStore } from './connection_store'
import Redis from 'ioredis'
import { logger } from '../logger'
import { ListenEventSet } from './listen_event_set'
import { RoomStore } from './room_store'
import { mapIterateAll } from '../utils'
import http from 'http'
import https from 'https'
import _ from 'lodash'
import { BackoffOptions, MessageManager } from './message_manager'

interface WsagiServerOptions {
  host?: string
  port?: number
  server?: http.Server | https.Server

  redis?: Redis.RedisOptions
  attempts?: number
  backoff?: number | BackoffOptions
}

export class WsagiServer extends EventEmitter2 {
  instance: WebSocket.Server
  connStore: ConnectionStore
  listenEventSet: ListenEventSet
  messageManager: MessageManager
  roomStore: RoomStore

  constructor(options: WsagiServerOptions) {
    super()

    // socket
    this.instance = new WebSocket.Server(
      _.pick(options, ['host', 'port', 'server'])
    )
    this.connStore = new ConnectionStore(options.redis)

    this.sendProc = this.sendProc.bind(this)
    this.messageManager = new MessageManager(
      this.sendProc,
      _.pick(options, ['attempts', 'backoff', 'redis'])
    )

    this.handleConnection = this.handleConnection.bind(this)

    this.instance.on('connection', this.handleConnection)

    this.listenEventSet = new ListenEventSet()
    this.roomStore = new RoomStore(options.redis)
  }

  private handleConnection(ws: WebSocket) {
    const id = this.connStore.add(ws)
    ws.on('message', message => {
      this.handleMessage(id, message)
    })
    ws.on('close', () => {
      this.connStore.remove(id)
    })
  }

  private handleMessage(clientId: string, data: WebSocket.Data) {
    const msg = decodeMessage(data)
    switch (msg.kind) {
      case MessageKind.Response:
        return this.handleResponse(msg as ResponseMessage)
      case MessageKind.Request:
        return this.handleRequest(msg as RequestMessage)
      case MessageKind.ListenEvent:
        return this.handleListenEvent(clientId, msg as ListenEventMessage)

      default:
        logger.error(`Unknown message kind ${msg.kind}`)
        return Promise.resolve()
    }
  }

  private handleResponse(msg: ResponseMessage) {
    return this.messageManager.acknowledged(msg.reqId)
  }

  private handleRequest(msg: RequestMessage) {
    this.emit(msg.event, msg.data)
  }

  private handleListenEvent(clientId: string, msg: ListenEventMessage) {
    this.listenEventSet.add(clientId, msg.event)
  }

  async send(clientId: string, event: string, data: any) {
    logger.info(`send(queuing) ${event} -> ${clientId}`)

    await this.messageManager.registMessage(clientId, event, data)
  }

  broadcast(event: string, data: any) {
    const idItr = this.connStore.allIds()

    return mapIterateAll(idItr, async id => {
      if (this.listenEventSet.hasListenEvent(id, event)) {
        await this.send(id, event, data)
      }
    })
  }

  async sendRoom(roomName: string, event: string, data: any) {
    const members = await this.roomStore.getRoomMembers(roomName)

    return Promise.all(
      members.map(m => {
        if (this.listenEventSet.hasListenEvent(m, event)) {
          return this.send(m, event, data)
        }
        return Promise.resolve()
      })
    )
  }

  async close(): Promise<void> {
    await this.messageManager.close()
    await this.roomStore.close()
    this.connStore.close()
    await new Promise((resolve, reject) => {
      this.instance.close(err => (err ? reject(err) : resolve()))
    })
  }

  async remainingSendingCount() {
    const msgs = await this.messageManager.remainingMessages()
    return msgs.length
  }

  clearRemainingSendings() {
    return this.messageManager.clear()
  }

  join(id: string, roomName: string) {
    this.roomStore.joinRoom(id, roomName)
  }

  getAllClientIds() {
    return this.connStore.allIds()
  }

  private sendProc(msgId: string, clientId: string, event: string, data: any) {
    const msg: RequestMessage = {
      kind: MessageKind.Request,
      id: msgId,
      event,
      data
    }
    logger.info(`send(actually) ${event} -> ${clientId}`)

    return this.connStore.send(clientId, encodeMessage(msg))
  }
}
