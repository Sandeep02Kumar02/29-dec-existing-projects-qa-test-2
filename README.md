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

`HOST=0.0.0.0` listens on all IPv4 interfaces, and the server speaks plain HTTP only (no TLS). Restrict access to intended clients with a firewall or a reverse proxy, and terminate TLS at the reverse proxy or a load balancer.

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

Errors handled by the application before the response headers are sent get a `4xx` or `5xx` status and a JSON body `{"error":"<message>"}`; `HEAD` error responses carry the same status and headers without a body. The status is `err.status` when it is an integer from `400` through `599`, otherwise `500`; `err.statusCode` is ignored. A `4xx` message is the standard HTTP reason phrase for the status (`Error` if it has none), and every `5xx` message is `Internal Server Error`. If the headers have already been sent, the error is logged and the connection is destroyed; no JSON body is sent.

The JSON and URL-encoded body parsers run before routing, so their `400`, `413` and `415` responses apply to every path. Bodies of other media types are not parsed.

| Condition | Status | Body |
| --- | --- | --- |
| No route matches the method and path, and the body parsers accepted the request (e.g. `POST /`, `GET /foo`, `OPTIONS /foo`). Matching is case-insensitive and accepts a trailing slash, so `/HEALTH` and `/health/` are served as `/health` | `404` | `{"error":"Not Found"}` |
| Malformed `application/json` body, including a top-level value that is not an object or array (e.g. `"text"` or `42`) | `400` | `{"error":"Bad Request"}` |
| `application/json` or `application/x-www-form-urlencoded` body larger than 102400 bytes (100 KiB), or a URL-encoded body with more than 1000 parameters | `413` | `{"error":"Payload Too Large"}` |
| `application/json` or `application/x-www-form-urlencoded` body with an unsupported charset (e.g. `charset=latin1`) or `Content-Encoding` (e.g. `zstd`) | `415` | `{"error":"Unsupported Media Type"}` |
| Unhandled error raised before the response headers are sent | `500` | `{"error":"Internal Server Error"}` |

## Logging

The application logs through Winston, one JSON object per line, with `level`, `message`, `timestamp`, and any request metadata as fields. Log lines at the `error` level are written to stderr; all other levels are written to stdout. Under `node server.js`, stdout and stderr carry only these raw JSON lines (NDJSON); `npm start` and `npm run dev` also print npm's `> hello_world@1.0.0 …` script banner on stdout first, unless run with `--silent`. If the reader of stdout or stderr goes away (`EPIPE`, for example when the output is piped into `head`), further output to that stream is discarded and the server keeps serving.

HTTP access logs use morgan's `combined` format and are written through Winston at the `info` level. The logged URL, referrer, and user-agent are each cut at their first `?`, so no query string is logged (see D15 in [`docs/decision-log.md`](docs/decision-log.md)). Error log entries never include query strings, and entries for `4xx` errors never include request-body snippets (see D14 and D17).

Under PM2, stdout is written to `./logs/out.log` and stderr to `./logs/error.log`. These paths are resolved relative to the directory PM2 is started from, so start PM2 from the project root. Both files are git-ignored. No log rotation is configured.

With `merge_logs: true` in `ecosystem.config.js`, every cluster worker writes to this one file pair, so lines from different workers are interleaved and there are no per-worker files. PM2's `log_date_format` prefixes each persisted line with PM2's own timestamp (local time plus UTC offset), so the files are not raw NDJSON. Each line has the form `<YYYY-MM-DD HH:mm:ss Z>: <JSON>`, for example:

```text
2026-10-01 11:15:56 +00:00: {"level":"info","message":"Server running at http://0.0.0.0:3000/","timestamp":"2026-10-01T11:15:56.034Z"}
```

Each persisted line therefore carries two timestamps: PM2's prefix and Winston's ISO-8601 `timestamp` field (see D23 and D25). Remove the prefix before parsing the JSON. For example, this prints `logs/out.log` as NDJSON (use the same command for `logs/error.log`):

```bash
sed 's/^[^{]*//' logs/out.log
```

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

PM2 (`pm2@7.0.3`) is a devDependency. The `npm run pm2:*` scripts use the local `pm2` binary, which npm installs only together with the dev dependencies. `npm ci --omit=dev` omits it, and so does plain `npm ci` when `NODE_ENV=production` is set in the installing environment. When the local PM2 scripts are needed, install with:

```bash
npm ci --include=dev
```

Without dev dependencies, the `npm run pm2:*` scripts have no `pm2` binary unless PM2 is installed globally. To use a global PM2 instead, run from the project root:

```bash
npm install -g pm2@7.0.3
pm2 start ecosystem.config.js --env production
```

Operational notes:

- Network exposure: `--env production` (used by `npm run pm2:start`, `npm run pm2:reload` and the global `pm2 start ecosystem.config.js --env production`) binds `0.0.0.0:3000`, which listens on all IPv4 interfaces over plain HTTP. Restrict access to intended clients with a firewall or a reverse proxy, and terminate TLS at the reverse proxy or a load balancer.
- `instances: 'max'` in `ecosystem.config.js` starts one worker per CPU core. Change `instances` in `ecosystem.config.js` to run a different number of workers (see D6 in [`docs/decision-log.md`](docs/decision-log.md)).
- Graceful shutdown: on `SIGTERM` or `SIGINT` the server stops accepting new connections and lets open connections drain before exiting. A keep-alive connection that is serving a request when the signal arrives is closed as soon as that response completes. If connections are still open after 4 seconds, the process is forced to exit. Before every exit the process waits up to 500 ms for pending log output to be written, so a forced exit completes within 4.5 seconds, below the PM2 `kill_timeout` of 5000 ms set in `ecosystem.config.js`.

## Testing

There is no automated test suite. `npm test` is the original placeholder script: it prints `Error: no test specified` and exits with code 1.

## Documentation

See [`docs/decision-log.md`](docs/decision-log.md) for the decision log and the `http` → Express traceability matrix.
