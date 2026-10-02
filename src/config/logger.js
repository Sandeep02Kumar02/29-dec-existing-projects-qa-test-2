const morgan = require('morgan');
const winston = require('winston');

const config = require('./index');

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console({ stderrLevels: ['error'] })]
});

const stripQuery = (value) => (typeof value === 'string' ? value.split('?')[0] : value);

morgan.token('referrer', (req) => stripQuery(req.headers.referer || req.headers.referrer));
morgan.token('user-agent', (req) => stripQuery(req.headers['user-agent']));

logger.stream = { write: (message) => logger.info(message.trim()) };

module.exports = logger;
