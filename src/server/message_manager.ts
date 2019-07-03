import Queue from 'bull'
import Redis from 'ioredis'
import { ulid } from 'ulid'

import { logger } from '../logger'
import { MessageStorage } from './message_storage'

interface QueueConfig {
  attempts: number
  backoff: number | Queue.BackoffOptions
}

export type BackoffOptions = Queue.BackoffOptions

interface MessageManagerOptions {
  redis?: Redis.RedisOptions
  attempts?: number
  backoff?: number | BackoffOptions
}

interface JobData {
  id: string
  event: string
  target: string
  data: any
}

export class MessageManager {
  queueConfig: QueueConfig
  queue: Queue.Queue<JobData>
  sender: (
    msgId: string,
    event: string,
    target: string,
    data: any
  ) => Promise<any>

  messageStorage: MessageStorage

  constructor(
    sender: (
      msgId: string,
      event: string,
      target: string,
      data: any
    ) => Promise<any>,
    options?: MessageManagerOptions
  ) {
    this.sender = sender
    this.initQueue(options)
    this.messageStorage = new MessageStorage(options.redis)
  }

  private initQueue(options: MessageManagerOptions) {
    this.queueConfig = {
      attempts: options && options.attempts ? options.attempts : 5,
      backoff: options && options.backoff ? options.backoff : 5
    }
    this.queue = new Queue<JobData>('wsagi_sendings', {
      redis: options.redis
    })

    this.processJob = this.processJob.bind(this)
    this.queue.process(this.processJob)

    this.queue.on('error', err => logger.error('queue error: %s', err))
    this.queue.on('failed', job => {
      logger.debug(`job[${job.data.id}] failed ${job.attemptsMade} times`)
      if (job.attemptsMade === job.opts.attempts) {
        logger.error(`finally, failed job[${job.data.id}`)
      }
    })
    this.queue.on('completed', (job, result) => {
      logger.debug(`job completed ${job.data.id} ${result}`)
    })
  }

  public async registMessage(target: string, event: string, data: any) {
    const id = this.generateMessageId()
    await this.messageStorage.add(id)
    await this.queue.add({ target, event, data, id }, this.queueConfig)
  }

  public async close() {
    this.messageStorage.close()
    await this.queue.close()
  }

  public acknowledged(id: string) {
    return this.messageStorage.done(id)
  }

  public remainingMessages() {
    return this.messageStorage.remainingMessages()
  }

  public async clear() {
    await this.messageStorage.clear()
    await this.queue.empty()
  }

  private async processJob(job: Queue.Job<JobData>) {
    try {
      // check
      const isDone = await this.messageStorage.isDone(job.data.id)

      if (isDone) {
        return Promise.resolve()
      }

      const { id, target, event, data } = job.data

      await this.sender(id, target, event, data)

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
