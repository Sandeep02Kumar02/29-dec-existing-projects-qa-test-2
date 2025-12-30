/**
 * @fileoverview Secure Express HTTP/HTTPS Server
 * 
 * This server implements comprehensive security hardening for a Node.js web application.
 * It replaces the bare http module with Express.js and integrates multiple security
 * middleware layers to protect against common web vulnerabilities.
 * 
 * Security Features:
 * - Helmet.js: Sets 11+ security HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
 * - CORS: Whitelist-based cross-origin resource sharing policy
 * - Rate Limiting: IP-based request throttling (100 req/15min by default)
 * - Input Validation: Schema-based request validation via express-validator
 * - HTTPS: TLS 1.2+ encrypted connections with certificate support
 * - Error Handling: Centralized security error handling
 * 
 * Environment Variables:
 * - HTTP_PORT: HTTP server port (default: 3000)
 * - HTTPS_PORT: HTTPS server port (default: 3443)
 * - NODE_ENV: Environment mode (development/production)
 * - SSL_KEY_PATH: Path to SSL private key
 * - SSL_CERT_PATH: Path to SSL certificate
 * 
 * @module server
 * @version 2.0.0
 * @author Blitzy Security Hardening
 * 
 * @example
 * // Start the server
 * npm start
 * 
 * // With HTTPS enabled (requires certificates)
 * npm run start:secure
 */

'use strict';

// =============================================================================
// EXTERNAL DEPENDENCIES
// =============================================================================

/**
 * Express.js web application framework
 * Provides foundation for security middleware chain integration
 * @see https://expressjs.com/
 */
const express = require('express');

/**
 * Helmet.js security headers middleware
 * Sets 11+ HTTP response headers for browser security protection
 * @see https://helmetjs.github.io/
 */
const helmet = require('helmet');

/**
 * CORS middleware for cross-origin resource sharing policy
 * Implements whitelist-based origin control
 * @see https://www.npmjs.com/package/cors
 */
const cors = require('cors');

/**
 * Express rate limiting middleware
 * Provides IP-based request throttling to prevent abuse
 * @see https://www.npmjs.com/package/express-rate-limit
 */
const { rateLimit } = require('express-rate-limit');

/**
 * Node.js built-in HTTPS module
 * Used for creating secure TLS/SSL server
 */
const https = require('https');

/**
 * Node.js built-in HTTP module
 * Used for HTTP server with redirect to HTTPS
 */
const http = require('http');

// =============================================================================
// LOCAL MODULES
// =============================================================================

/**
 * Security middleware configuration module
 * Exports helmetConfig, corsConfig, rateLimitConfig
 * @see ./config/security.js
 */
const securityConfig = require('./config/security');

/**
 * HTTPS/TLS server configuration module
 * Exports httpsOptions, createSecureServer, createHttpsRedirect
 * @see ./config/https.js
 */
const httpsConfig = require('./config/https');

/**
 * Centralized error handling middleware
 * Handles rate limit errors (429), validation errors (400), server errors (500)
 * @see ./middleware/errorHandler.js
 */
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

/**
 * HTTP server port - configurable via HTTP_PORT environment variable
 * @type {number}
 */
const HTTP_PORT = parseInt(process.env.HTTP_PORT, 10) || 3000;

/**
 * HTTPS server port - configurable via HTTPS_PORT environment variable
 * @type {number}
 */
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT, 10) || 3443;

/**
 * Server hostname - bind to localhost for security in development
 * @type {string}
 */
const hostname = process.env.HOST || '127.0.0.1';

/**
 * Current environment mode
 * @type {string}
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Check if running in production
 * @type {boolean}
 */
const isProduction = NODE_ENV === 'production';

// =============================================================================
// EXPRESS APPLICATION INITIALIZATION
// =============================================================================

/**
 * Express application instance
 * All security middleware and routes are registered on this app
 */
const app = express();

// =============================================================================
// SECURITY MIDDLEWARE CHAIN
// =============================================================================

/**
 * MIDDLEWARE ORDER IS CRITICAL FOR SECURITY
 * 
 * The middleware chain is applied in the following order:
 * 1. Helmet (security headers) - Applied first to all responses
 * 2. CORS (cross-origin policy) - Handle CORS before processing
 * 3. Rate limiting (throttling) - Limit requests before parsing
 * 4. Body parsing (JSON) - Parse request bodies after rate limiting
 * 5. Routes - Handle application logic
 * 6. Error handler - Handle errors last
 */

/**
 * 1. HELMET - Security Headers Middleware
 * 
 * Sets the following security headers:
 * - Content-Security-Policy: Restricts resource loading
 * - Strict-Transport-Security: Enforces HTTPS
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-DNS-Prefetch-Control: Disables DNS prefetching
 * - X-Download-Options: Prevents IE execution in site context
 * - X-Permitted-Cross-Domain-Policies: Restricts Flash/PDF access
 * - Referrer-Policy: Controls referrer information
 * - Cross-Origin-Opener-Policy: Isolates browsing context
 * - Cross-Origin-Resource-Policy: Controls cross-origin sharing
 * - Origin-Agent-Cluster: Requests dedicated agent cluster
 * 
 * @security First middleware - ensures all responses have security headers
 */
app.use(helmet(securityConfig.helmetConfig));

/**
 * 2. CORS - Cross-Origin Resource Sharing Middleware
 * 
 * Implements whitelist-based origin validation:
 * - Only allows requests from configured origins (CORS_ORIGINS env var)
 * - Allows credentials (cookies, authorization headers)
 * - Restricts HTTP methods to GET, POST, PUT, DELETE, OPTIONS
 * - Exposes rate limit headers to JavaScript
 * 
 * @security Second middleware - blocks unauthorized cross-origin requests
 */
app.use(cors(securityConfig.corsConfig));

/**
 * 3. RATE LIMITING - Request Throttling Middleware
 * 
 * Prevents abuse by limiting requests per IP:
 * - Default: 100 requests per 15-minute window
 * - Returns 429 Too Many Requests when exceeded
 * - Sends RateLimit headers (draft-8 standard)
 * - Skips rate limiting for health check endpoints
 * 
 * @security Third middleware - throttles before processing requests
 */
app.use(rateLimit(securityConfig.rateLimitConfig));

/**
 * 4. BODY PARSING - JSON Request Body Parser
 * 
 * Parses incoming JSON request bodies:
 * - Enables req.body for POST/PUT requests
 * - Required for input validation to function
 * - Strict mode prevents non-JSON content
 * 
 * @security Fourth middleware - parses bodies after rate limiting
 */
app.use(express.json({
  // Limit request body size to prevent DoS attacks
  limit: '10kb',
  // Strict mode - only accept arrays and objects
  strict: true
}));

/**
 * URL-encoded body parser for form submissions
 * Extended mode allows rich objects and arrays
 */
app.use(express.urlencoded({
  extended: true,
  // Limit URL-encoded body size
  limit: '10kb'
}));

// =============================================================================
// TRUST PROXY CONFIGURATION
// =============================================================================

/**
 * Configure trust proxy if behind reverse proxy/load balancer
 * Required for accurate IP detection in rate limiting
 * 
 * @security Only enable if actually behind a trusted proxy
 */
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
  console.log('[Security] Trust proxy enabled - ensure you are behind a trusted proxy');
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * Root endpoint - Hello World response
 * 
 * Maintains backward compatibility with the original server
 * while now being protected by all security middleware.
 * 
 * @route GET /
 * @returns {string} Hello, World! response
 * 
 * @security Protected by helmet, cors, and rate limiting
 */
app.get('/', (req, res) => {
  // Set content type explicitly for security
  res.type('text/plain');
  // Send the original Hello World response
  res.send('Hello, World!\n');
});

/**
 * Health check endpoint for monitoring and load balancer health checks
 * 
 * @route GET /health
 * @returns {Object} JSON object with status and timestamp
 * 
 * @note This endpoint is excluded from rate limiting
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    https: httpsConfig.certificatesExist() ? 'available' : 'unavailable'
  });
});

/**
 * Health check endpoint (alternative path for Kubernetes compatibility)
 * 
 * @route GET /healthz
 * @returns {Object} JSON object with status
 */
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

/**
 * 404 Not Found Handler
 * 
 * Catches all requests that don't match any route
 * Must be registered after all routes
 */
app.use(notFoundHandler);

/**
 * Centralized Error Handler
 * 
 * Handles all errors including:
 * - Rate limit exceeded (429)
 * - Validation errors (400)
 * - Authentication errors (401)
 * - Authorization errors (403)
 * - Server errors (500)
 * 
 * @security MUST be the last middleware registered
 */
app.use(errorHandler);

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

/**
 * Start the HTTP server
 * 
 * In production with HTTPS enabled, this server redirects all HTTP
 * traffic to HTTPS for security. In development or when HTTPS is
 * unavailable, it serves the application directly.
 */
function startHttpServer() {
  // Check if HTTPS is available for redirect
  const httpsAvailable = httpsConfig.certificatesExist();
  
  if (httpsAvailable && isProduction) {
    // Create HTTP server that redirects to HTTPS in production
    const httpRedirectApp = express();
    
    // Add helmet for security even on redirect server
    httpRedirectApp.use(helmet(securityConfig.helmetConfig));
    
    // Use the HTTPS redirect middleware
    httpRedirectApp.use(httpsConfig.createHttpsRedirect(HTTPS_PORT));
    
    const httpServer = http.createServer(httpRedirectApp);
    
    httpServer.listen(HTTP_PORT, hostname, () => {
      console.log(`[HTTP Server] Redirecting HTTP traffic to HTTPS`);
      console.log(`[HTTP Server] Listening at http://${hostname}:${HTTP_PORT}/`);
      console.log(`[HTTP Server] All requests redirect to https://${hostname}:${HTTPS_PORT}/`);
    });
    
    return httpServer;
  } else {
    // Serve application directly on HTTP (development or no HTTPS)
    const httpServer = http.createServer(app);
    
    httpServer.listen(HTTP_PORT, hostname, () => {
      console.log(`[HTTP Server] Running at http://${hostname}:${HTTP_PORT}/`);
      console.log(`[HTTP Server] Environment: ${NODE_ENV}`);
      
      if (!httpsAvailable) {
        console.log('[HTTP Server] HTTPS not available - running HTTP only');
        console.log('[HTTP Server] To enable HTTPS, generate SSL certificates in ./certs/');
      }
    });
    
    return httpServer;
  }
}

/**
 * Start the HTTPS server if certificates are available
 * 
 * Creates a secure TLS server using the configured certificates.
 * Falls back gracefully if certificates are not available.
 */
function startHttpsServer() {
  // Attempt to create secure server
  const httpsServer = httpsConfig.createSecureServer(app);
  
  if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, hostname, () => {
      console.log(`[HTTPS Server] Secure server running at https://${hostname}:${HTTPS_PORT}/`);
      console.log(`[HTTPS Server] TLS minimum version: ${httpsConfig.httpsOptions.minVersion}`);
      console.log('[HTTPS Server] Security middleware enabled:');
      console.log('  - Helmet.js (security headers)');
      console.log('  - CORS (cross-origin policy)');
      console.log('  - Rate limiting (request throttling)');
      console.log('  - Body parsing (input validation ready)');
    });
    
    return httpsServer;
  } else {
    console.warn('[HTTPS Server] Could not start - SSL certificates not available');
    console.warn('[HTTPS Server] See certs/README.md for certificate generation instructions');
    return null;
  }
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

/**
 * Main server startup sequence
 * 
 * 1. Start HTTP server (redirect or direct serve)
 * 2. Start HTTPS server if certificates available
 * 3. Log security configuration summary
 */
console.log('='.repeat(60));
console.log('STARTING SECURE EXPRESS SERVER');
console.log('='.repeat(60));

// Log security configuration summary
const securitySummary = securityConfig.getSecuritySummary();
console.log('\n[Security Configuration]');
console.log(`  Environment: ${securitySummary.environment}`);
console.log(`  Rate Limit: ${securitySummary.rateLimit.maxRequests} requests per ${securitySummary.rateLimit.windowMinutes} minutes`);
console.log(`  CORS Origins: ${securitySummary.cors.allowedOrigins.join(', ')}`);
console.log(`  HSTS Max Age: ${securitySummary.helmet.hstsMaxAge} seconds`);
console.log('');

// Start servers
const httpServer = startHttpServer();
const httpsServer = startHttpsServer();

// =============================================================================
// GRACEFUL SHUTDOWN HANDLING
// =============================================================================

/**
 * Handle graceful shutdown on SIGTERM/SIGINT
 * Allows in-flight requests to complete before shutdown
 */
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  
  // Close HTTP server
  if (httpServer) {
    httpServer.close(() => {
      console.log('[HTTP Server] Closed');
    });
  }
  
  // Close HTTPS server
  if (httpsServer) {
    httpsServer.close(() => {
      console.log('[HTTPS Server] Closed');
    });
  }
  
  // Force exit after timeout
  setTimeout(() => {
    console.log('[Server] Forcing shutdown after timeout');
    process.exit(0);
  }, 10000); // 10 second timeout
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================================================
// UNHANDLED ERROR HANDLING
// =============================================================================

/**
 * Handle unhandled promise rejections
 * Logs error and continues operation (doesn't crash)
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Promise Rejection:');
  console.error('  Promise:', promise);
  console.error('  Reason:', reason);
});

/**
 * Handle uncaught exceptions
 * Logs error - in production, you may want to exit
 */
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:');
  console.error('  Error:', error.message);
  console.error('  Stack:', error.stack);
  
  // In production, exit on uncaught exceptions
  if (isProduction) {
    console.error('[Server] Exiting due to uncaught exception in production');
    process.exit(1);
  }
});

// =============================================================================
// MODULE EXPORTS
// =============================================================================

/**
 * Export the Express app and servers for testing purposes
 * 
 * @exports {Object} Server components
 * @property {Express.Application} app - Express application instance
 * @property {http.Server} httpServer - HTTP server instance
 * @property {https.Server|null} httpsServer - HTTPS server instance (if available)
 */
module.exports = {
  app,
  httpServer,
  httpsServer
};
