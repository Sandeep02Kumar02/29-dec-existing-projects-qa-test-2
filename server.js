const http = require('http');

const config = require('./src/config');
const app = require('./src/app');
const logger = require('./src/config/logger');

const SHUTDOWN_TIMEOUT_MS = 4000;

const server = http.createServer(app);

server.on('error', (err) => {
  logger.error('HTTP server error', {
    code: err.code,
    syscall: err.syscall,
    address: err.address,
    port: err.port,
    message: err.message
  });
  process.exit(1);
});

server.listen(config.PORT, config.HOST, () => {
  logger.info(`Server running at http://${config.HOST}:${config.PORT}/`);
});

let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) {
    logger.warn(`${signal} received: shutdown already in progress`);
    return;
  }
  shuttingDown = true;
  logger.info(`${signal} received: closing HTTP server`);
  setTimeout(() => {
    logger.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS} ms: forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  server.close((err) => {
    if (err) {
      logger.error('HTTP server close failed', { code: err.code, message: err.message });
      process.exit(1);
      return;
    }
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
