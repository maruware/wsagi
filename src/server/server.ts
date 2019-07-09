import WebSocket from 'ws'
import {
  encodeMessage,
  MessageKind,
  RequestMessage,
  ResponseMessage,
  ListenEventMessage
} from '../common/message'
import { EventEmitter } from 'events'

import { ConnectionStore } from './connection_store'
import Redis from 'ioredis'
import { logger } from '../logger'
import { ListenEventStore } from './listen_event_set'
import { RoomStore } from './room_store'
import http from 'http'
import https from 'https'
import _ from 'lodash'
import { BackoffOptions, MessageManager } from './message_manager'
import { all } from '@maruware/promise-tools'
import { Conneciton } from './conneciton'

interface WsagiServerOptions {
  host?: string
  port?: number
  server?: http.Server | https.Server

  redis?: Redis.RedisOptions
  attempts?: number
  backoff?: number | BackoffOptions
}

export declare interface WsagiServer {
  on(event: 'connection', listener: (conn: Conneciton) => void): this
  on(event: string, listener: Function): this
}

export class WsagiServer extends EventEmitter {
  instance: WebSocket.Server
  connStore: ConnectionStore
  listenEventStore: ListenEventStore
  messageManager: MessageManager
  roomStore: RoomStore

  constructor(options: WsagiServerOptions) {
    super()

    this.sendProc = this.sendProc.bind(this)
    this.handleConnection = this.handleConnection.bind(this)
    this.handleResponse = this.handleResponse.bind(this)

    // socket
    this.instance = new WebSocket.Server(
      _.pick(options, ['host', 'port', 'server'])
    )
    this.connStore = new ConnectionStore(options.redis)

    this.messageManager = new MessageManager(
      this.sendProc,
      _.pick(options, ['attempts', 'backoff', 'redis'])
    )

    this.instance.on('connection', this.handleConnection)

    this.listenEventStore = new ListenEventStore(options.redis)
    this.roomStore = new RoomStore(options.redis)
  }

  private handleConnection(ws: WebSocket) {
    const conn = this.connStore.add(ws)

    conn.on('close', async () => {
      this.connStore.remove(conn.id)
      await this.roomStore.leaveAllRooms(conn.id)
      await this.listenEventStore.removeAll(conn.id)
    })
    conn.on('__response__', this.handleResponse)
    conn.on('__receive_listen_event__', msg => {
      this.handleListenEvent(conn.id, msg)
    })

    this.emit('connection', conn)
  }

  private handleResponse(msg: ResponseMessage) {
    return this.messageManager.acknowledged(msg.reqId)
  }

  private handleListenEvent(clientId: string, msg: ListenEventMessage) {
    this.listenEventStore.add(clientId, msg.event)
  }

  async send(clientId: string, event: string, data: any) {
    logger.info(`send(queueing) ${event} -> ${clientId}`)

    await this.messageManager.registMessage(clientId, event, data)
  }

  async broadcast(event: string, data: any) {
    const ids = await this.connStore.allIds()

    return Promise.all(
      ids.map(async id => {
        const isListen = await this.listenEventStore.hasListenEvent(id, event)
        if (isListen) {
          await this.send(id, event, data)
        }
      })
    )
  }

  async sendRoom(roomName: string, event: string, data: any) {
    const members = await this.roomStore.getRoomMembers(roomName)

    return Promise.all(
      members.map(async m => {
        const isListen = await this.listenEventStore.hasListenEvent(m, event)
        if (isListen) {
          await this.send(m, event, data)
        }
      })
    )
  }

  async close(): Promise<void> {
    await new Promise((resolve, reject) => {
      this.instance.close(err => (err ? reject(err) : resolve()))
    })
    await this.messageManager.close()
    this.listenEventStore.close()
    await this.roomStore.close()
    this.connStore.close()
  }

  async remainingSendingCount() {
    const msgs = await this.messageManager.remainingMessages()
    return msgs.length
  }

  clearRemainingSendings() {
    return this.messageManager.clear()
  }

  clearAll() {
    return all(
      this.listenEventStore.clear(),
      this.connStore.clear(),
      this.roomStore.clear(),
      this.messageManager.clear()
    )
  }

  join(id: string, roomName: string) {
    this.roomStore.joinRoom(id, roomName)
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
