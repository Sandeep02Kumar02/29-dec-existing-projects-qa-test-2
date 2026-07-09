# hao-backprop-test

A minimal Node.js HTTP server enhanced into a production-ready [Express.js](https://expressjs.com/) application. It preserves the original `Hello, World!` response on `GET /` and adds a routing layer, a middleware pipeline (helmet, compression, body parsers, and morgan HTTP logging piped into winston), environment-based configuration, structured logging, and PM2 process management for production deployment.

## Prerequisites

- [Node.js](https://nodejs.org/) `>= 18` (tested on Node.js 22 LTS)
- npm (bundled with Node.js)

## Installation

Install the dependencies:

```bash
npm install
```

## Configuration

Copy the example environment file and adjust the values as needed:

```bash
cp .env.example .env
```

The application reads the following environment variables (all have safe defaults):

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | TCP port the server listens on | `3000` |
| `HOST` | Host / interface to bind | `127.0.0.1` |
| `NODE_ENV` | Application environment (`development` \| `production`) | `development` |
| `LOG_LEVEL` | Winston log level (`error` \| `warn` \| `info` \| `http` \| `debug`, ...) | `info` |

## Running

Start the server:

```bash
# Production-style start
npm start

# Development
npm run dev
```

Available endpoints:

- `GET /` — returns `Hello, World!` as `text/plain`.
- `GET /health` — returns a JSON liveness payload, e.g. `{ "status": "ok", "uptime": <seconds> }`.

## Production Deployment with PM2

The project includes a PM2 ecosystem file (`ecosystem.config.js`) configured for clustered execution. Use the following npm scripts to manage the process:

```bash
# Start in production (cluster mode); runs: pm2 start ecosystem.config.js --env production
npm run pm2:start

# Zero-downtime reload
npm run pm2:reload

# Stop the app
npm run pm2:stop

# Tail logs
npm run pm2:logs
```

## Documentation

See [`docs/decision-log.md`](docs/decision-log.md) for the decision log and the `http` → Express traceability matrix.
