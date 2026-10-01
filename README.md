# hao-backprop-test

A minimal Node.js HTTP server enhanced into a production-ready [Express.js](https://expressjs.com/) application. It preserves the original `Hello, World!` response on `GET /` and adds a routing layer, a middleware pipeline (helmet, compression, body parsers, and morgan HTTP logging piped into winston), environment-based configuration, structured logging, and PM2 process management for production deployment.

## Prerequisites

- [Node.js](https://nodejs.org/) `>= 18` (tested on Node.js 22 LTS)
- npm (bundled with Node.js)

## Installation

Install the exact dependency versions pinned in the committed `package-lock.json`:

```bash
npm ci
```

`npm install` also works, but unlike `npm ci` it may rewrite `package-lock.json`.

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

Precedence: a variable already present in the process environment (exported in the shell, or set by PM2) takes precedence over the value in `.env`; `.env` only fills in variables that are not already set.

Under PM2, the `env` and `env_production` blocks in `ecosystem.config.js` set all four variables, so they override `.env` (and any value exported in the shell that launches PM2):

| Variable | `env` (default) | `env_production` (`--env production`) |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | `3000` |
| `HOST` | `127.0.0.1` | `0.0.0.0` |
| `LOG_LEVEL` | `info` | `info` |

To change these values for PM2 runs, edit them in `ecosystem.config.js`.

When running the server directly (`npm start`, `npm run dev`, or `node server.js`), the default `HOST=127.0.0.1` accepts local connections only. Set `HOST=0.0.0.0` to accept external connections (see D12 in [`docs/decision-log.md`](docs/decision-log.md)), for example:

```bash
HOST=0.0.0.0 PORT=8080 npm start
```

## Running

Start the server:

```bash
# Production-style start
npm start

# Development
npm run dev
```

Available endpoints:

- `GET /` — returns HTTP `200` with the body `Hello, World!\n` (exactly `Hello, World!` followed by a trailing newline) as `text/plain; charset=utf-8`.
- `GET /health` — returns HTTP `200` with a JSON liveness payload: `{"status":"ok","uptime":<seconds>}`.

Express answers `HEAD` and `OPTIONS` requests to `/` and `/health` automatically: `HEAD` returns the `GET` status and headers without a body, and `OPTIONS` returns `200` with `Allow: GET, HEAD`.

Error responses are JSON and always carry a `4xx` or `5xx` status:

| Condition | Status | Body |
| --- | --- | --- |
| Any other path or method (e.g. `POST /`, `GET /foo`) | `404` | `{"error":"Not Found"}` |
| Malformed JSON request body | `400` | `{"error":"Bad Request"}` |
| Request body over the 100 kB body-parser limit | `413` | `{"error":"Payload Too Large"}` |
| Unexpected server failure | `500` | `{"error":"Internal Server Error"}` |

## Logging

The application logs through Winston, one JSON object per line, with `level`, `message`, `timestamp`, and any request metadata as fields. Log lines at the `error` level are written to stderr; all other levels are written to stdout.

HTTP access logs use morgan's `combined` format and are written through Winston at the `info` level. The logged URL has its query string removed (see D15 in [`docs/decision-log.md`](docs/decision-log.md)). Error log entries never include query strings, and entries for `4xx` errors never include request-body snippets (see D14 and D17).

Under PM2, stdout is written to `./logs/out.log` and stderr to `./logs/error.log`. These paths are resolved relative to the directory PM2 is started from, so start PM2 from the project root. Both files are git-ignored. No log rotation is configured.

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

PM2 (`pm2@7.0.3`) is a devDependency. The `npm run pm2:*` scripts use the local `pm2` binary that `npm ci` installs together with the other dev dependencies. After `npm ci --omit=dev`, the `npm run pm2:*` scripts have no `pm2` binary unless PM2 is installed globally. To use a global PM2 instead, run from the project root:

```bash
npm install -g pm2@7.0.3
pm2 start ecosystem.config.js --env production
```

Operational notes:

- `instances: 'max'` in `ecosystem.config.js` starts one worker per CPU core. Change `instances` in `ecosystem.config.js` to run a different number of workers (see D6 in [`docs/decision-log.md`](docs/decision-log.md)).
- Graceful shutdown: on `SIGTERM` or `SIGINT` the server stops accepting new connections and lets open connections drain before exiting. If connections are still open after 4 seconds, the process is forced to exit. The 4-second limit is below the PM2 `kill_timeout` of 5000 ms set in `ecosystem.config.js`.

## Testing

There is no automated test suite. `npm test` is the original placeholder script: it prints `Error: no test specified` and exits with code 1.

## Documentation

See [`docs/decision-log.md`](docs/decision-log.md) for the decision log and the `http` → Express traceability matrix.
