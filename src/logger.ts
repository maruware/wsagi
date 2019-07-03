import winston, { format } from 'winston'

export const logger = winston.createLogger({
  level: 'debug',
  format: format.combine(format.splat(), format.simple()),
  transports: [new winston.transports.Console()]
})
