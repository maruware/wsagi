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
import { SocketSet } from './socket_set'
import Redis from 'ioredis'
import { logger } from '../logger'
import { ListenEventSet } from './listen_event_set'
import { RoomSet } from './room_set'
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
  wss: WebSocket.Server
  sockets: SocketSet
  listenEventSet: ListenEventSet
  messageManager: MessageManager
  rooms: RoomSet

  constructor(options: WsagiServerOptions) {
    super()

    // socket
    this.wss = new WebSocket.Server(_.pick(options, ['host', 'port', 'server']))
    this.sockets = new SocketSet()

    this.sendProc = this.sendProc.bind(this)
    this.messageManager = new MessageManager(
      this.sendProc,
      _.pick(options, ['attempts', 'backoff', 'redis'])
    )

    this.handleConnection = this.handleConnection.bind(this)

    this.wss.on('connection', this.handleConnection)

    this.listenEventSet = new ListenEventSet()
    this.rooms = new RoomSet()
  }

  private handleConnection(ws: WebSocket) {
    const id = this.sockets.add(ws)
    ws.on('message', message => {
      this.handleMessage(id, message)
    })
    ws.on('close', () => {
      this.sockets.remove(id)
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
    logger.info(`send ${event} -> ${clientId}`)

    await this.messageManager.registMessage(clientId, event, data)
  }

  broadcast(event: string, data: any) {
    const idItr = this.sockets.allIds()

    return mapIterateAll(idItr, async id => {
      if (this.listenEventSet.hasListenEvent(id, event)) {
        await this.send(id, event, data)
      }
    })
  }

  sendRoom(roomName: string, event: string, data: any) {
    const itr = this.rooms.getRoomMembers(roomName)
    if (!itr) {
      logger.warn(`No existing room ${roomName}`)
      return Promise.resolve()
    }
    return mapIterateAll(itr, async id => {
      if (this.listenEventSet.hasListenEvent(id, event)) {
        await this.send(id, event, data)
      }
    })
  }

  async close(): Promise<void> {
    await this.messageManager.close()

    await new Promise((resolve, reject) => {
      this.wss.close(err => (err ? reject(err) : resolve()))
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
    this.rooms.joinRoom(id, roomName)
  }

  getAllClientIds() {
    return this.sockets.allIds()
  }

  private sendProc(msgId: string, clientId: string, event: string, data: any) {
    const msg: RequestMessage = {
      kind: MessageKind.Request,
      id: msgId,
      event,
      data
    }
    return this.sockets.send(clientId, encodeMessage(msg))
  }
}
