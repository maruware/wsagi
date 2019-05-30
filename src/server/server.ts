import WebSocket from 'ws'
import { decodeMessage, Message, encodeMessage } from '../common/message'
import { EventEmitter2 } from 'eventemitter2'
import Queue from 'bull'
import uuid from 'uuid/v4'
import { SocketSet } from './socket_set'
import { MessageManager } from './message_manager'
import Redis from 'ioredis'
import { logger } from '../logger'

const mapIterateAll = <In, Out>(
  iterator: IterableIterator<In>,
  func: (item: In) => Promise<Out>
) => {
  const promises: Promise<Out>[] = []

  for (let item of iterator) {
    promises.push(func(item))
  }
  return Promise.all(promises)
}

interface SendingJob {
  clientId: string
  message: Message
}

export class WsagiServer extends EventEmitter2 {
  wss: WebSocket.Server
  sockets: SocketSet
  queue: Queue.Queue<SendingJob>
  messageManager: MessageManager

  constructor(
    wsOptions?: WebSocket.ServerOptions,
    redisOptions?: Redis.RedisOptions
  ) {
    super()
    this.wss = new WebSocket.Server(wsOptions)
    this.sockets = new SocketSet()
    this.messageManager = new MessageManager(redisOptions)

    this.handleConnection = this.handleConnection.bind(this)

    this.wss.on('connection', this.handleConnection)
    this.queue = new Queue<SendingJob>('wsagi_sendings', {
      redis: redisOptions
    })

    this.processJob = this.processJob.bind(this)
    this.queue.process(this.processJob)
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

  private handleMessage(clientId: string, message: WebSocket.Data) {
    const msg = decodeMessage(message)
    if (msg.isResponse) {
      return this.handleResponse(msg)
    } else {
      return this.handleRequest(msg)
    }
  }

  private handleResponse(msg: Message) {
    return this.messageManager.done(msg.id)
  }

  private handleRequest(msg: Message) {
    this.emit(msg.event, msg.data)
  }

  async send(clientId: string, event: string, data: any) {
    logger.info(`send ${event} -> ${clientId}`)
    const msgId = this.generateMessageId()
    const msg: Message = {
      id: msgId,
      event,
      data,
      isResponse: false
    }
    await this.messageManager.add(msgId)

    return this.queue.add({ clientId, message: msg })
  }

  broadcast(event: string, data: any) {
    const idItr = this.sockets.allIds()

    return mapIterateAll(idItr, async id => {
      await this.send(id, event, data)
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
    return uuid()
  }
}
