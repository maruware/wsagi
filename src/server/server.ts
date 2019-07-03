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
import Queue from 'bull'
import { ulid } from 'ulid'
import { SocketSet } from './socket_set'
import { MessageManager } from './message_manager'
import Redis from 'ioredis'
import { logger } from '../logger'
import { ListenEventSet } from './listen_event_set'
import { RoomSet } from './room_set'
import { mapIterateAll } from '../utils'
import http from 'http'
import https from 'https'
import _ from 'lodash'

interface SendingJob {
  clientId: string
  message: RequestMessage
}

interface QueueConfig {
  attempts: number
  backoff: number | Queue.BackoffOptions
}

interface WsagiServerOptions {
  host?: string
  port?: number
  server?: http.Server | https.Server

  redis?: Redis.RedisOptions
  attempts?: number
  backoff?: number | Queue.BackoffOptions
}

export class WsagiServer extends EventEmitter2 {
  wss: WebSocket.Server
  sockets: SocketSet
  listenEventSet: ListenEventSet
  queue: Queue.Queue<SendingJob>
  messageManager: MessageManager
  queueConfig: QueueConfig
  rooms: RoomSet

  constructor(options: WsagiServerOptions) {
    super()

    // socket
    this.wss = new WebSocket.Server(_.pick(options, ['host', 'port', 'server']))
    this.sockets = new SocketSet()
    this.messageManager = new MessageManager(options.redis)

    this.handleConnection = this.handleConnection.bind(this)

    this.wss.on('connection', this.handleConnection)

    this.listenEventSet = new ListenEventSet()
    this.rooms = new RoomSet()

    // queue
    this.initQueue(options)
  }

  private initQueue(options: WsagiServerOptions) {
    this.queueConfig = {
      attempts: options && options.attempts ? options.attempts : 5,
      backoff: options && options.backoff ? options.backoff : 5
    }
    this.queue = new Queue<SendingJob>('wsagi_sendings', {
      redis: options.redis
    })

    this.processJob = this.processJob.bind(this)
    this.queue.process(this.processJob)

    this.queue.on('error', err => logger.error('queue error: %s', err))
    this.queue.on('failed', job => {
      logger.debug(
        `job[${job.data.message.id}] failed ${job.attemptsMade} times`
      )
      if (job.attemptsMade === job.opts.attempts) {
        logger.error(`finally, failed job[${job.data.message.id}`)
      }
    })
    this.queue.on('completed', (job, result) => {
      logger.debug(`job completed ${job.data.message.id} ${result}`)
    })
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
    return this.messageManager.done(msg.reqId)
  }

  private handleRequest(msg: RequestMessage) {
    this.emit(msg.event, msg.data)
  }

  private handleListenEvent(clientId: string, msg: ListenEventMessage) {
    this.listenEventSet.add(clientId, msg.event)
  }

  async send(clientId: string, event: string, data: any) {
    logger.info(`send ${event} -> ${clientId}`)
    const msgId = this.generateMessageId()
    const msg: RequestMessage = {
      kind: MessageKind.Request,
      id: msgId,
      event,
      data
    }
    await this.messageManager.add(msgId)

    return this.queue.add({ clientId, message: msg }, this.queueConfig)
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
    await this.queue.close()
    this.messageManager.close()

    await new Promise((resolve, reject) => {
      this.wss.close(err => (err ? reject(err) : resolve()))
    })
  }

  async remainingSendCount() {
    const msgs = await this.messageManager.remainingMessages()
    return msgs.length
  }

  clearRemainingSends() {
    return this.messageManager.clear()
  }

  join(id: string, roomName: string) {
    this.rooms.joinRoom(id, roomName)
  }

  getAllClientIds() {
    return this.sockets.allIds()
  }

  private async processJob(job: Queue.Job<SendingJob>) {
    try {
      // check
      const isDone = await this.messageManager.isDone(job.data.message.id)

      if (isDone) {
        return Promise.resolve()
      }

      await this.sockets.send(
        job.data.clientId,
        encodeMessage(job.data.message)
      )

      return Promise.reject(new Error('not yet received message'))
    } catch (e) {
      logger.error(e)
      return Promise.reject(e)
    }
  }

  private generateMessageId() {
    return ulid()
  }
}
