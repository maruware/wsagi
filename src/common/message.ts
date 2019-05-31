import WebSocket from 'ws'

export enum MessageKind {
  Request,
  Response,
  ListenEvent
}

export interface Message {
  kind: MessageKind
  event: string
}

export interface RequestMessage extends Message {
  kind: MessageKind.Request
  id: string
  data?: any
}

export interface ResponseMessage extends Message {
  kind: MessageKind.Response
  reqId: string
  data?: any
}

export interface ListenEventMessage extends Message {
  kind: MessageKind.ListenEvent
}

export const decodeMessage = (msg: WebSocket.Data) => {
  if (typeof msg !== 'string') {
    throw new Error(`Unsupported message type ${typeof msg}`)
  }
  return JSON.parse(msg) as Message
}

export const encodeMessage = (msg: Message) => {
  return JSON.stringify(msg)
}
