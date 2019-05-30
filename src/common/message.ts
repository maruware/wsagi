import WebSocket from 'ws'

export interface Message {
  id: string
  event: string
  isResponse: boolean
  data?: any
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
