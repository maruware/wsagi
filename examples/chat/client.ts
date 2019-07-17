import { WsagiClient } from '../../src/client'
import readline from 'readline'

const port = 8080
const client = new WsagiClient(`ws://localhost:${port}/`)

const proc = async () => {
  client.on('new_msg', (data: any) => {
    console.log(`${data.name}: ${data.text}`)
  })

  let name: string = null

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const asyncQuestion = (rl: readline.Interface, q: string) => {
    return new Promise<string>(resolve => {
      rl.question(q, answer => {
        resolve(answer)
      })
    })
  }

  const waitMessage = async (rl: readline.Interface) => {
    const msg = await asyncQuestion(rl, '')
    client.send('msg', { name, text: msg })
    await waitMessage(rl)
  }

  name = await asyncQuestion(rl, 'What your name? ')
  await waitMessage(rl)
}

client.on('open', () => {
  proc()
})
