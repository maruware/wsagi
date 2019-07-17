import { WsagiServer } from '../../src/server'

const port = 8080
const server = new WsagiServer({
  port,
  redis: { host: process.env.REDIS_HOST }
})
server.on('connection', conn => {
  conn.on('msg', (data: any) => {
    server.broadcast('new_msg', data)
  })
})
