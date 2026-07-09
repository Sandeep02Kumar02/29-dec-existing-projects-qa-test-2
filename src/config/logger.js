const winston = require('winston');

const config = require('./index');

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

logger.stream = { write: (message) => logger.info(message.trim()) };

module.exports = logger;
