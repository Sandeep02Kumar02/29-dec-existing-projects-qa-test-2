# Decision Log & Traceability Matrix

This document is the authoritative record of every non-trivial implementation decision made while migrating the original raw Node.js `http` server into a production-ready Express.js application. It is the single source of truth for the "why" behind those decisions (per the Explainability rule); that rationale is intentionally kept here and is **not** duplicated in code comments anywhere in the project.

## Decision Log

| ID | Decision | Alternatives Considered | Rationale | Risks / Mitigation |
|----|----------|-------------------------|-----------|--------------------|
| D1 | Adopt Express `5.2.1` | Express 4.x; Fastify; Koa; remain on core `http` | Prompt explicitly names Express; v5 is current stable with built-in body parsing and modern routing; requires Node `>=18` (Node 22 satisfies) | v5 has breaking changes vs v4; low risk on a greenfield app |
| D2 | Winston `3.19.0` for structured logging | Pino; bunyan; `console` only | Mature transports/levels/formats, widely documented | Heavier than Pino; acceptable at this scale |
| D3 | Morgan `1.11.0` for HTTP logs piped to Winston | Custom middleware; Winston-only | Standard, minimal, integrates via a write stream | Extra dependency; justified by clean access-log separation |
| D4 | Add `helmet 8.2.0` + `compression 1.8.1` | Omit; add only if asked | "Prepare for production deployment" implies baseline security/perf middleware | Deviation from a literal reading of "middleware"; flagged under minimal-changes and justified as production hardening |
| D5 | `dotenv 17.4.2` for env config | convict; node-config; env-only | De-facto minimal standard; wrapped by one config module | `.env` could leak secrets; mitigated by `.gitignore` + committed `.env.example` |
| D6 | PM2 cluster mode via `ecosystem.config.js` | fork mode; systemd; Docker; bare CLI | Prompt names PM2; ecosystem file is the reproducible production standard; cluster uses all cores | Cluster needs stateless app + graceful shutdown; addressed by SIGTERM/SIGINT handling |
| D7 | Keep `server.js` as entry; set `main`/`start` to it | Create `index.js` to match current `main` | Preserves the known working filename and PM2 script target; avoids a second entry file | Reconciles the previously dangling `main` [package.json:L5] |
| D8 | Split `app.js` (exports app) from `server.js` (listens) | Single file that builds and listens | Enables testing without binding a port; documented Express convention | One extra file; negligible |
| D9 | Preserve `Hello, World!\n` on `GET /` | Change or drop the payload | "Hello World" rule + minimal-changes mandate preserving existing behavior [server.js:L9] | None; explicitly mandated |
| D10 | Treat user prompt as superseding README "Do not touch!" and Tech Spec §1.3.2 exclusions | Refuse enhancement; honor "Do not touch!" | The explicit, newer user instruction is authoritative over stale repo/spec framing | Historical docs become outdated; mitigated by updating README and this AAP |
| D11 | Exclude `cross-env` | Include it | PM2 env blocks + dotenv already handle env vars for the run targets | Cross-platform inline env in npm scripts would need it; not required by current scripts |
| D12 | Default `HOST=127.0.0.1`, env-overridable | Hardcode `0.0.0.0`; keep `127.0.0.1` fixed | Preserves existing binding [server.js:L3] while allowing production to bind `0.0.0.0` via env | Operators must set `HOST` for external exposure; documented in `.env.example`/README |
| D13 | Leave `server - Copy.js` untouched | Delete it; update it too | Minimal-changes rule; unreferenced duplicate outside the run path [server - Copy.js:L1-L14] | Duplicate remains; acceptable, out of scope |
| D14 | Sanitize centralized error handling: `errorHandler.js` returns the HTTP reason phrase for 4xx and a generic `Internal Server Error` for 5xx (never raw `err.message`), redacts query strings from every logged field (URL, detail, and the 5xx-only stack), and `notFound.js` builds its message from `req.path` (not `req.originalUrl`) so query strings are dropped at the source | (a) Keep returning/logging raw `err.message` (original impl); (b) gate exposure on the `err.expose` flag | Code review flagged a MAJOR security defect: raw messages leaked malformed-JSON parser internals to clients and echoed request query strings (e.g. `?token=secret`) into both responses and logs. Body-parser 400 errors carry `expose=true`, so `err.expose` alone would still leak parser detail; deterministic reason phrases are leak-free while preserving the AAP `{ error }` + `err.status || 500` contract and the mandatory 4-argument error-handler arity. Morgan access logging (AAP-mandated `combined` format in `app.js`) is unchanged and out of scope for this finding | Clients receive less-specific messages; mitigated by logging redacted diagnostics (status, method, query-redacted URL, detail, and stack for 5xx) server-side for debugging |
| D15 | Redact query strings from Morgan HTTP access logs: override Morgan's built-in `:url` token so it emits only the request path (the substring before `?`), keeping the AAP-mandated `combined` format and the Winston `logger.stream` sink | (a) Keep plain `combined` (leaks the full query string); (b) redact only known-sensitive parameter names such as token/password via a custom token; (c) switch to a lighter `dev`/`short` preset | Code review flagged a MAJOR sensitive-data-in-logs defect (CWE-532): the `combined` `:url` token logged full URLs, so a request to `/unknown?token=secret` wrote `?token=secret` into the access log. Stripping everything from `?` onward guarantees no query value (known or unknown) is ever logged, extends to access logs the same query-redaction discipline already applied to error logs in D14, and preserves the combined format, the access-logging requirement, and the Morgan-to-Winston pipeline. Name-based redaction was rejected because it cannot enumerate every sensitive parameter and would still leak unknown ones | Access logs no longer include query strings, marginally reducing debugging signal; mitigated because method, path, status, size, referrer, and user-agent are all retained. Overriding a built-in token is module-global, but Morgan is instantiated exactly once so no other format is affected |
| D16 | Load dotenv via `require('dotenv').config({ quiet: true })` to suppress its startup console banner | (a) Leave the default banner (the `injected env ...` tip line); (b) set `DOTENV_CONFIG_QUIET=true` through the environment; (c) intercept and redirect stdout | dotenv 17.x prints an unstructured banner/tip to stdout on load, before Winston initializes, which breaks the structured-logging guarantee that all process output is Winston JSON. The pinned dotenv 17.4.2 supports the `quiet` option, so `{ quiet: true }` is the minimal, in-code, deterministic suppression that keeps startup output consistently structured | The informational injected-env line is hidden; mitigated because it carried no operational value, dotenv debug mode can be re-enabled ad hoc if needed, and Winston remains the single structured log source |
| D17 | For **4xx client errors**, log the deterministic HTTP reason phrase (plus the safe, enumerated body-parser `err.type`, e.g. `entity.parse.failed` / `entity.too.large`) as the server-side `detail`, instead of the raw `err.message`; **5xx** errors continue to log the query-redacted `err.message` and stack. This refines the server-side `detail` field described in D14's mitigation | (a) Keep logging `redactQuery(err.message)` for every status (the original D14 behavior); (b) redact only known secret patterns (token/password) from `err.message`; (c) drop the `detail` field entirely | Final acceptance flagged a MAJOR sensitive-data-in-logs defect (CWE-532): body-parser JSON syntax errors set `err.message` to a string that embeds a snippet of the raw request body (e.g. `Unexpected token 'P', "PASSWORD=s"... is not valid JSON`), and `redactQuery` strips only query strings, so that body snippet — potentially a secret — was written to the structured error log even though the client response was already sanitized. For a 4xx the message is derived from client-supplied input and adds no diagnostic value beyond the status and `err.type`, so the reason phrase plus `err.type` are sufficient and leak-free; 5xx messages are server-authored and retained (query-redacted) for debugging. Pattern-based redaction was rejected because it cannot enumerate every secret shape | 4xx error logs no longer include the parser's specific message; mitigated because status, method, query-redacted URL, and the enumerated `err.type` are retained, and the sanitized client `{ error }` response, the `err.status`-driven code, and the mandatory 4-argument arity are all unchanged |

## Traceability Matrix (http → Express)

This bidirectional matrix provides 100% coverage of the original `server.js` constructs and accounts for every net-new target introduced by the migration.

### Source → Target

Every original construct is accounted for.

| # | Source Construct (`server.js`) | Target Implementation |
|---|--------------------------------|-----------------------|
| 1 | `require('http')` [server.js:L1] | Retained in `server.js` to host Express via `http.createServer(app)` |
| 2 | `const hostname = '127.0.0.1'` [server.js:L3] | `config.HOST` (`src/config/index.js`), default `127.0.0.1`, from `.env` |
| 3 | `const port = 3000` [server.js:L4] | `config.PORT` (`src/config/index.js`), default `3000`, from `.env` |
| 4 | `http.createServer((req,res)=>{...})` [server.js:L6] | `app = express()` (`src/app.js`) hosted by `http.createServer(app)` (`server.js`) |
| 5 | `res.statusCode = 200` [server.js:L7] | Express default `200` on matched routes (`src/routes/index.js`) |
| 6 | `res.setHeader('Content-Type','text/plain')` [server.js:L8] | `res.type('text/plain')` on `GET /` (`src/routes/index.js`) |
| 7 | `res.end('Hello, World!\n')` [server.js:L9] | `res.send('Hello, World!\n')` on `GET /` (`src/routes/index.js`) |
| 8 | `server.listen(port, hostname, cb)` [server.js:L12] | `server.listen(config.PORT, config.HOST, cb)` (`server.js`) |
| 9 | `console.log(startup banner)` [server.js:L13] | `logger.info(startup banner)` via Winston (`src/config/logger.js`) |

### Target → Source

Every net-new target traces to a mandating requirement.

| Net-New Target | Mandating Requirement |
|----------------|-----------------------|
| `GET /health` route (`src/routes/index.js`) | "add routing" + production-readiness |
| Middleware pipeline: helmet, compression, express.json/urlencoded, morgan (`src/app.js`) | "add middleware" |
| `src/middleware/notFound.js`, `src/middleware/errorHandler.js` | "add middleware" (error handling) |
| `src/config/index.js`, `.env`, `.env.example` | "environment config" |
| `src/config/logger.js` | "logging" |
| `ecosystem.config.js`, PM2 scripts, graceful shutdown | "prepare for production deployment with PM2" |
| `.gitignore` | Implicit prerequisite (exclude `node_modules`/`.env`/logs) |
| `docs/decision-log.md` | Explainability rule |
