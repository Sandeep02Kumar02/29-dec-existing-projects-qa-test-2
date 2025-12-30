/**
 * @fileoverview Express.js Server with Security Hardening
 * 
 * This is the main entry point for the Node.js application.
 * It implements comprehensive security controls including:
 * - Security headers via Helmet.js
 * - CORS policy enforcement
 * - Rate limiting protection
 * - Input validation via express-validator
 * - HTTPS support with TLS
 * 
 * Security Middleware Chain Order:
 * 1. helmet() - Security headers
 * 2. cors() - Cross-origin policy
 * 3. rateLimit() - Request throttling
 * 4. express.json() - Body parsing
 * 5. Routes - Application logic
 * 6. errorHandler - Centralized error handling
 * 
 * @module server
 * @version 1.0.0
 */

'use strict';

// =============================================================================
// DEPENDENCIES
// =============================================================================

const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

// Security configuration
const { helmetConfig, corsConfig, rateLimitConfig, getSecuritySummary } = require('./config/security');
const { createSecureServer, createHttpsRedirect, certificatesExist, env: httpsEnv } = require('./config/https');

// Middleware
const { validateRequest, validationSchemas } = require('./middleware/validation');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

/**
 * Server port configuration
 * @type {number}
 */
const HTTP_PORT = parseInt(process.env.HTTP_PORT, 10) || 3000;
const HTTPS_PORT = httpsEnv.HTTPS_PORT;

/**
 * Hostname for server binding
 * @type {string}
 */
const HOSTNAME = process.env.HOSTNAME || '127.0.0.1';

/**
 * Node environment
 * @type {string}
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Whether HTTPS mode is enabled
 * @type {boolean}
 */
const HTTPS_MODE = httpsEnv.HTTPS_ENABLED && certificatesExist();

// =============================================================================
// EXPRESS APPLICATION SETUP
// =============================================================================

/**
 * Express application instance
 * @type {Object}
 */
const app = express();

// Trust proxy if behind load balancer/reverse proxy
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// =============================================================================
// SECURITY MIDDLEWARE CHAIN
// =============================================================================

/**
 * 1. Helmet.js - Security Headers
 * Sets various HTTP headers for security (CSP, HSTS, etc.)
 */
app.use(helmet(helmetConfig));

/**
 * 2. CORS - Cross-Origin Resource Sharing
 * Controls which origins can access the API
 */
app.use(cors(corsConfig));

/**
 * 3. Rate Limiting - Request Throttling
 * Limits requests per IP to prevent abuse
 */
app.use(rateLimit(rateLimitConfig));

/**
 * 4. Body Parser - JSON Parsing
 * Parses incoming JSON request bodies
 * Limited to 10kb to prevent large payload attacks
 */
app.use(express.json({ limit: '10kb' }));

/**
 * URL-encoded body parser
 * For form submissions
 */
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/**
 * Note: Body sanitization is applied per-route using validationSchemas.sanitizeBody
 * This allows for more granular control over which routes need sanitization.
 * Example: app.post('/route', ...validationSchemas.sanitizeBody, validateRequest, handler)
 */

// =============================================================================
// ROUTES
// =============================================================================

/**
 * Health check endpoint
 * Used by load balancers and monitoring systems
 * 
 * @route GET /health
 * @route GET /healthz
 * @returns {Object} Health status
 */
app.get(['/health', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Main endpoint - Hello World
 * Returns the classic "Hello, World!" message
 * 
 * @route GET /
 * @returns {string} Hello, World!
 */
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('Hello, World!\n');
});

/**
 * Security information endpoint (development only)
 * Returns current security configuration summary
 * 
 * @route GET /security-info
 * @returns {Object} Security configuration summary
 */
if (NODE_ENV !== 'production') {
  app.get('/security-info', (req, res) => {
    res.json({
      message: 'Security configuration (development only)',
      config: getSecuritySummary(),
    });
  });
}

/**
 * Example POST endpoint with validation
 * Demonstrates input validation capabilities
 * 
 * @route POST /echo
 * @param {Object} req.body - Request body to echo
 * @returns {Object} Echoed request body
 */
app.post('/echo',
  validationSchemas.validateJson,
  validateRequest,
  (req, res) => {
    res.json({
      message: 'Echo successful',
      received: req.body,
      timestamp: new Date().toISOString(),
    });
  }
);

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * 404 Not Found handler
 * Catches all unmatched routes
 */
app.use(notFoundHandler);

/**
 * Centralized error handler
 * Handles all errors consistently
 */
app.use(errorHandler);

// =============================================================================
// SERVER STARTUP
// =============================================================================

/**
 * Start the server(s) based on configuration.
 * In HTTPS mode, starts both HTTP (for redirect) and HTTPS servers.
 * In HTTP mode, starts only HTTP server.
 */
const startServer = () => {
  // Log security configuration at startup
  console.log('\n=== Security Configuration ===');
  console.log(JSON.stringify(getSecuritySummary(), null, 2));
  console.log('==============================\n');

  if (HTTPS_MODE) {
    // Create HTTPS server
    const httpsServer = createSecureServer(app);
    
    if (httpsServer) {
      // Start HTTPS server
      httpsServer.listen(HTTPS_PORT, HOSTNAME, () => {
        console.log(`[HTTPS] Secure server running at https://${HOSTNAME}:${HTTPS_PORT}/`);
      });

      // Create HTTP server for redirect
      const httpRedirectApp = express();
      httpRedirectApp.use(createHttpsRedirect(HTTPS_PORT));
      
      const httpServer = http.createServer(httpRedirectApp);
      httpServer.listen(HTTP_PORT, HOSTNAME, () => {
        console.log(`[HTTP] Redirect server running at http://${HOSTNAME}:${HTTP_PORT}/ (redirects to HTTPS)`);
      });
    } else {
      console.warn('[HTTPS] Failed to create secure server, falling back to HTTP');
      startHttpOnly();
    }
  } else {
    startHttpOnly();
  }
};

/**
 * Start HTTP-only server (development mode or when certificates not available)
 */
const startHttpOnly = () => {
  const httpServer = http.createServer(app);
  
  httpServer.listen(HTTP_PORT, HOSTNAME, () => {
    console.log(`[HTTP] Server running at http://${HOSTNAME}:${HTTP_PORT}/`);
    
    if (NODE_ENV === 'production') {
      console.warn('[WARNING] Running in production without HTTPS is not recommended!');
      console.warn('[WARNING] Configure SSL certificates for secure communication.');
    }
  });
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = (signal) => {
  console.log(`\n[SERVER] Received ${signal}, shutting down gracefully...`);
  
  // Give active connections time to complete
  setTimeout(() => {
    console.log('[SERVER] Shutdown complete');
    process.exit(0);
  }, 1000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

// =============================================================================
// MODULE EXPORTS (for testing)
// =============================================================================

module.exports = {
  app,
  startServer,
};
