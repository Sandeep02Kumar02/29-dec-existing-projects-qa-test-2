const http = require('http');

const config = require('./src/config');
const app = require('./src/app');
const logger = require('./src/config/logger');

const SHUTDOWN_TIMEOUT_MS = 4000;
const LOG_FLUSH_TIMEOUT_MS = 500;

let pendingWrites = 0;
let onWritesSettled = null;

const trackWrites = (stream) => {
  const write = stream.write;
  stream.write = function (chunk, encoding, callback) {
    const done = typeof encoding === 'function' ? encoding : callback;
    pendingWrites += 1;
    try {
      return write.call(this, chunk, typeof encoding === 'function' ? undefined : encoding, (err) => {
        pendingWrites -= 1;
        if (typeof done === 'function') {
          done(err);
        }
        if (pendingWrites === 0 && onWritesSettled) {
          onWritesSettled();
        }
      });
    } catch (err) {
      pendingWrites -= 1;
      throw err;
    }
  };
};

trackWrites(process.stdout);
trackWrites(process.stderr);

const onOutputError = (err) => {
  if (err.code === 'EPIPE') {
    return;
  }
  throw err;
};

process.stdout.on('error', onOutputError);
process.stderr.on('error', onOutputError);

let shuttingDown = false;
let exiting = false;
let shutdownTimer = null;

const terminate = (code, level, ...args) => {
  if (exiting) {
    return;
  }
  exiting = true;
  shuttingDown = true;
  clearTimeout(shutdownTimer);
  logger[level](...args);
  const exit = () => process.exit(code);
  setTimeout(exit, LOG_FLUSH_TIMEOUT_MS);
  setImmediate(() => {
    if (pendingWrites === 0) {
      exit();
      return;
    }
    onWritesSettled = exit;
  });
};

const server = http.createServer(app);

const onServerError = (err) => {
  terminate(1, 'error', 'HTTP server error', {
    code: err.code,
    syscall: err.syscall,
    address: err.address,
    port: err.port,
    message: err.message
  });
};

server.on('error', onServerError);

const closeIdleConnections = () => server.closeIdleConnections();

const onResponseFinish = () => {
  if (shuttingDown && typeof server.closeIdleConnections === 'function') {
    setImmediate(closeIdleConnections);
  }
};

server.on('request', (req, res) => {
  res.on('finish', onResponseFinish);
});

try {
  server.listen(config.PORT, config.HOST, () => {
    logger.info(`Server running at http://${config.HOST}:${config.PORT}/`);
  });
} catch (err) {
  onServerError(err);
}

const shutdown = (signal) => {
  if (shuttingDown) {
    logger.warn(`${signal} received: shutdown already in progress`);
    return;
  }
  shuttingDown = true;
  logger.info(`${signal} received: closing HTTP server`);
  shutdownTimer = setTimeout(() => {
    terminate(1, 'error', `Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS} ms: forcing exit`);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  server.close((err) => {
    if (err) {
      terminate(1, 'error', 'HTTP server close failed', { code: err.code, message: err.message });
      return;
    }
    terminate(0, 'info', 'HTTP server closed');
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
