const http = require('http');

const logger = require('../config/logger');

const redactQuery = (value) =>
  typeof value === 'string' ? value.replace(/\?[^\s]*/g, '') : value;

module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const clientMessage = status < 500
    ? http.STATUS_CODES[status] || 'Error'
    : 'Internal Server Error';

  const detail = status < 500 ? clientMessage : redactQuery(err.message);

  logger.error(clientMessage, {
    status,
    method: req.method,
    url: redactQuery(req.originalUrl),
    detail,
    ...(err.type ? { type: err.type } : {}),
    ...(status >= 500 ? { stack: redactQuery(err.stack) } : {})
  });

  res.status(status).json({ error: clientMessage });
};
