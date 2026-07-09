const http = require('http');

const config = require('./src/config');
const app = require('./src/app');
const logger = require('./src/config/logger');

const server = http.createServer(app);

server.listen(config.PORT, config.HOST, () => {
  logger.info(`Server running at http://${config.HOST}:${config.PORT}/`);
});

const shutdown = (signal) => {
  logger.info(`${signal} received: closing HTTP server`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
