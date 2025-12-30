/**
 * @fileoverview Security Middleware Configuration Module
 * 
 * This module provides centralized security configuration for the Express.js application.
 * It exports configuration objects for helmet.js (security headers), CORS policies,
 * and rate limiting. All settings can be customized via environment variables.
 * 
 * Security Headers (via helmet.js):
 * - Content-Security-Policy: Prevents XSS and injection attacks
 * - Strict-Transport-Security: Enforces HTTPS connections
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - Plus 7+ additional security headers
 * 
 * Environment Variables:
 * - NODE_ENV: Environment mode (development/production/test)
 * - RATE_LIMIT_WINDOW_MS: Rate limit window in milliseconds (default: 900000 = 15 min)
 * - RATE_LIMIT_MAX: Maximum requests per window (default: 100)
 * - CORS_ORIGINS: Comma-separated allowed origins (default: 'http://localhost:3000')
 * - TRUST_PROXY: Whether app is behind reverse proxy (default: false)
 * 
 * @module config/security
 * @version 1.0.0
 */

'use strict';

// =============================================================================
// ENVIRONMENT VARIABLES
// =============================================================================

/**
 * Current environment mode
 * @type {string}
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Rate limit window in milliseconds
 * @type {number}
 */
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000; // 15 minutes

/**
 * Maximum requests allowed per rate limit window
 * @type {number}
 */
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

/**
 * Comma-separated list of allowed CORS origins
 * @type {string}
 */
const CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3000';

/**
 * Whether the application is behind a reverse proxy (load balancer, nginx, etc.)
 * @type {boolean}
 */
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

/**
 * Check if running in production environment
 * @type {boolean}
 */
const isProduction = NODE_ENV === 'production';

// =============================================================================
// HELMET CONFIGURATION (Security Headers)
// =============================================================================

/**
 * Helmet.js configuration for setting HTTP security headers.
 * 
 * This configuration enables 11+ security headers:
 * - Content-Security-Policy: Restricts resource loading to same origin
 * - Cross-Origin-Opener-Policy: Isolates browsing context
 * - Cross-Origin-Resource-Policy: Controls cross-origin resource sharing
 * - Origin-Agent-Cluster: Requests dedicated agent cluster
 * - Referrer-Policy: Controls referrer information
 * - Strict-Transport-Security: Enforces HTTPS for 180 days
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-DNS-Prefetch-Control: Disables DNS prefetching
 * - X-Download-Options: Prevents IE from executing downloads
 * - X-Frame-Options: Prevents clickjacking
 * - X-Permitted-Cross-Domain-Policies: Restricts Adobe Flash/PDF access
 * 
 * @type {Object}
 * @property {Object} contentSecurityPolicy - CSP directives configuration
 * @property {Object} strictTransportSecurity - HSTS configuration
 * @property {Object} xFrameOptions - X-Frame-Options configuration
 * 
 * @example
 * // Usage with helmet middleware
 * const helmet = require('helmet');
 * const { helmetConfig } = require('./config/security');
 * app.use(helmet(helmetConfig));
 * 
 * @security
 * - In production, ensure HTTPS is properly configured before enabling HSTS
 * - Content-Security-Policy may need adjustment for third-party resources
 * - X-Frame-Options 'sameorigin' allows same-origin framing only
 */
const helmetConfig = {
  /**
   * Content Security Policy configuration
   * Restricts which resources the browser can load for the page
   * 
   * @security Default 'self' allows only same-origin resources.
   * Adjust directives for legitimate third-party content (CDNs, analytics, etc.)
   */
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      // Upgrade insecure requests in production
      upgradeInsecureRequests: isProduction ? [] : null,
    },
    // Report violations (configure reportUri for production monitoring)
    reportOnly: false,
  },

  /**
   * HTTP Strict Transport Security configuration
   * Tells browsers to only use HTTPS for future requests
   * 
   * @security
   * - maxAge: 180 days (15552000 seconds) - how long browsers remember HTTPS-only
   * - includeSubDomains: applies to all subdomains
   * - preload: enables HSTS preload list submission (only enable if committed to HTTPS)
   */
  strictTransportSecurity: {
    maxAge: 15552000, // 180 days in seconds
    includeSubDomains: true,
    preload: isProduction, // Only enable preload in production
  },

  /**
   * X-Frame-Options configuration
   * Prevents the page from being embedded in iframes (clickjacking protection)
   * 
   * @security 'sameorigin' allows framing only by same-origin pages
   * Use 'deny' for complete frame blocking if iframes are not needed
   */
  xFrameOptions: {
    action: 'sameorigin',
  },

  /**
   * Cross-Origin-Opener-Policy
   * Isolates browsing context to prevent cross-origin attacks
   */
  crossOriginOpenerPolicy: {
    policy: 'same-origin',
  },

  /**
   * Cross-Origin-Resource-Policy
   * Restricts which origins can load this resource
   */
  crossOriginResourcePolicy: {
    policy: 'same-origin',
  },

  /**
   * Referrer-Policy
   * Controls how much referrer information is sent
   * 
   * @security 'strict-origin-when-cross-origin' sends full URL for same-origin,
   * only origin for cross-origin (better privacy while maintaining analytics)
   */
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  /**
   * X-Content-Type-Options
   * Prevents browsers from MIME-sniffing the response
   */
  xContentTypeOptions: true, // Sets 'nosniff'

  /**
   * X-DNS-Prefetch-Control
   * Disables DNS prefetching to prevent privacy leaks
   */
  xDnsPrefetchControl: {
    allow: false,
  },

  /**
   * X-Download-Options (IE-specific)
   * Prevents IE from executing downloads in site context
   */
  xDownloadOptions: true, // Sets 'noopen'

  /**
   * X-Permitted-Cross-Domain-Policies
   * Restricts Adobe Flash and PDF from accessing site
   */
  xPermittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },

  /**
   * X-XSS-Protection
   * Disabled as it can introduce vulnerabilities in modern browsers
   * Modern browsers have built-in XSS protection via CSP
   */
  xXssProtection: false,
};

// =============================================================================
// CORS CONFIGURATION
// =============================================================================

/**
 * Parse allowed origins from environment variable
 * Converts comma-separated string to array of allowed origins
 * 
 * @returns {string[]} Array of allowed origin URLs
 */
const parseAllowedOrigins = () => {
  return CORS_ORIGINS
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
};

/**
 * CORS origin validation callback
 * Validates incoming request origins against the whitelist
 * 
 * @param {string} origin - The origin of the incoming request
 * @param {Function} callback - Callback function (error, allow)
 * @security
 * - Returns true for whitelisted origins only
 * - Allows requests with no origin (same-origin, non-browser clients)
 * - Logs rejected origins in development for debugging
 */
const corsOriginCallback = (origin, callback) => {
  const allowedOrigins = parseAllowedOrigins();
  
  // Allow requests with no origin (same-origin requests, Postman, curl, etc.)
  if (!origin) {
    return callback(null, true);
  }
  
  // Check if origin is in whitelist
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  
  // In development, log rejected origins for debugging
  if (!isProduction) {
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    console.warn(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
  }
  
  // Reject the request with a CORS error
  const corsError = new Error(`Origin '${origin}' not allowed by CORS policy`);
  corsError.status = 403;
  return callback(corsError, false);
};

/**
 * CORS configuration for cross-origin resource sharing policy.
 * 
 * Controls which external domains can access the API and what
 * HTTP methods and headers are permitted.
 * 
 * @type {Object}
 * @property {Function} origin - Origin validation callback
 * @property {string[]} methods - Allowed HTTP methods
 * @property {boolean} credentials - Whether to allow credentials
 * @property {number} optionsSuccessStatus - Status code for preflight responses
 * @property {string[]} allowedHeaders - Headers allowed in requests
 * 
 * @example
 * // Usage with cors middleware
 * const cors = require('cors');
 * const { corsConfig } = require('./config/security');
 * app.use(cors(corsConfig));
 * 
 * @security
 * - NEVER use origin: '*' with credentials: true (security vulnerability)
 * - Keep allowed origins list as restrictive as possible
 * - Review allowedHeaders for sensitive header exposure
 */
const corsConfig = {
  /**
   * Origin validation
   * Uses callback function for whitelist-based validation
   * Configure CORS_ORIGINS env var for production domains
   */
  origin: corsOriginCallback,

  /**
   * Allowed HTTP methods
   * Standard REST methods for typical API operations
   * 
   * @security Remove unused methods to reduce attack surface
   */
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  /**
   * Allow credentials (cookies, authorization headers)
   * Required for authenticated cross-origin requests
   * 
   * @security When true, origin cannot be '*' (wildcard)
   */
  credentials: true,

  /**
   * Status code for successful OPTIONS (preflight) requests
   * 200 provides better compatibility with legacy browsers
   * (some proxies reject 204 No Content)
   */
  optionsSuccessStatus: 200,

  /**
   * Headers allowed in incoming requests
   * Content-Type: for JSON/form data
   * Authorization: for Bearer tokens, API keys
   * 
   * @security Add only headers your API actually uses
   */
  allowedHeaders: ['Content-Type', 'Authorization'],

  /**
   * Headers exposed to the browser
   * These headers are accessible via JavaScript in responses
   */
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],

  /**
   * Max age for preflight cache (in seconds)
   * Reduces preflight requests for better performance
   */
  maxAge: 86400, // 24 hours
};

// =============================================================================
// RATE LIMIT CONFIGURATION
// =============================================================================

/**
 * Custom handler for rate limit exceeded responses.
 * Provides consistent error response format and logging.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @param {Object} options - Rate limiter options
 */
const rateLimitHandler = (req, res, next, options) => {
  // Log rate limit violations for monitoring
  const clientIP = req.ip || req.connection.remoteAddress;
  const endpoint = req.originalUrl || req.url;
  
  console.warn(`[RATE_LIMIT] Limit exceeded for IP: ${clientIP}, endpoint: ${endpoint}`);
  
  // Return standardized error response
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: Math.ceil(options.windowMs / 1000),
  });
};

/**
 * Skip rate limiting for certain requests
 * 
 * @param {Object} req - Express request object
 * @returns {boolean} True to skip rate limiting
 */
const rateLimitSkip = (req) => {
  // Skip rate limiting for health check endpoints
  if (req.path === '/health' || req.path === '/healthz') {
    return true;
  }
  
  // In development, optionally skip for localhost
  // Uncomment below if needed for development:
  // if (!isProduction && req.ip === '127.0.0.1') {
  //   return true;
  // }
  
  return false;
};

/**
 * Rate limiting configuration for request throttling.
 * 
 * Protects against brute-force attacks, DDoS, and API abuse
 * by limiting the number of requests per client.
 * 
 * @type {Object}
 * @property {number} windowMs - Time window in milliseconds
 * @property {number} limit - Maximum requests per window
 * @property {string} standardHeaders - RateLimit header format
 * @property {boolean} legacyHeaders - Whether to send X-RateLimit-* headers
 * @property {Object} message - Response body when limit exceeded
 * @property {Function} handler - Custom handler for limit exceeded
 * 
 * @example
 * // Usage with express-rate-limit middleware
 * const { rateLimit } = require('express-rate-limit');
 * const { rateLimitConfig } = require('./config/security');
 * app.use(rateLimit(rateLimitConfig));
 * 
 * @security
 * - Adjust windowMs and limit based on your API's legitimate usage patterns
 * - Consider stricter limits for authentication endpoints
 * - Enable TRUST_PROXY if behind a load balancer/reverse proxy
 */
const rateLimitConfig = {
  /**
   * Time window for rate limiting in milliseconds
   * Default: 15 minutes (900000ms)
   * 
   * @security Shorter windows provide more protection but may impact UX
   */
  windowMs: RATE_LIMIT_WINDOW_MS,

  /**
   * Maximum number of requests allowed per window
   * Default: 100 requests per 15 minutes
   * 
   * @security
   * - Too low: legitimate users get blocked
   * - Too high: insufficient protection against abuse
   * - Monitor actual usage to find the right balance
   */
  limit: RATE_LIMIT_MAX,

  /**
   * Use modern standardized RateLimit headers (draft-8)
   * Sends: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
   */
  standardHeaders: 'draft-8',

  /**
   * Disable deprecated X-RateLimit-* headers
   * These are non-standard and being phased out
   */
  legacyHeaders: false,

  /**
   * Response body when rate limit is exceeded
   * Used if no custom handler is provided
   */
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit for this endpoint.',
    retryAfter: 'See Retry-After header',
  },

  /**
   * Custom handler function for rate limit exceeded
   * Provides logging and consistent error responses
   */
  handler: rateLimitHandler,

  /**
   * Function to skip rate limiting for certain requests
   * Useful for health checks and trusted clients
   */
  skip: rateLimitSkip,

  /**
   * Key generator for identifying clients
   * Uses IP address by default, handles proxied requests
   */
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind a trusted proxy
    if (TRUST_PROXY) {
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        // Take the first IP in the chain (original client)
        return forwardedFor.split(',')[0].trim();
      }
    }
    return req.ip || req.connection.remoteAddress || 'unknown';
  },

  /**
   * Whether to validate trust proxy settings
   * Helps detect misconfiguration in production
   */
  validate: {
    trustProxy: TRUST_PROXY,
    xForwardedForHeader: TRUST_PROXY,
  },
};

// =============================================================================
// ADDITIONAL SECURITY HELPERS
// =============================================================================

/**
 * Get security configuration summary for logging/debugging
 * 
 * @returns {Object} Summary of current security configuration
 */
const getSecuritySummary = () => {
  const allowedOrigins = parseAllowedOrigins();
  
  return {
    environment: NODE_ENV,
    isProduction,
    helmet: {
      cspEnabled: !!helmetConfig.contentSecurityPolicy,
      hstsMaxAge: helmetConfig.strictTransportSecurity.maxAge,
      frameOptions: helmetConfig.xFrameOptions.action,
    },
    cors: {
      allowedOrigins,
      methods: corsConfig.methods,
      credentials: corsConfig.credentials,
    },
    rateLimit: {
      windowMs: rateLimitConfig.windowMs,
      windowMinutes: rateLimitConfig.windowMs / 60000,
      maxRequests: rateLimitConfig.limit,
      trustProxy: TRUST_PROXY,
    },
  };
};

// =============================================================================
// MODULE EXPORTS
// =============================================================================

module.exports = {
  /**
   * Helmet.js configuration for security headers
   * @see helmetConfig
   */
  helmetConfig,

  /**
   * CORS configuration for cross-origin policy
   * @see corsConfig
   */
  corsConfig,

  /**
   * Rate limiting configuration
   * @see rateLimitConfig
   */
  rateLimitConfig,

  /**
   * Get current security configuration summary
   * @see getSecuritySummary
   */
  getSecuritySummary,

  /**
   * Environment variables exposed for testing/debugging
   */
  env: {
    NODE_ENV,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX,
    CORS_ORIGINS,
    TRUST_PROXY,
    isProduction,
  },
};
