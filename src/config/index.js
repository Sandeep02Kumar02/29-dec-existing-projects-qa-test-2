require('dotenv').config({ quiet: true });

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

module.exports = { PORT, HOST, NODE_ENV, LOG_LEVEL };
