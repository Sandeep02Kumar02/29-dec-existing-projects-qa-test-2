/**
 * @fileoverview Centralized Express Error Handling Middleware
 * 
 * This module provides centralized error handling for the Express application,
 * specifically designed for security-related errors including:
 * - Rate limit exceeded (429)
 * - Validation errors (400)
 * - Authentication/Authorization errors (401/403)
 * - General server errors (500)
 * 
 * Features:
 * - Consistent JSON error response format: { success: boolean, error: string, ... }
 * - Environment-aware error details (hides sensitive info in production)
 * - Comprehensive error logging for monitoring
 * - Prevents leaking sensitive error information in production
 * 
 * @module middleware/errorHandler
 * @version 1.0.0
 * 
 * @example
 * // Usage in Express app - MUST be registered LAST after all routes
 * const errorHandler = require('./middleware/errorHandler');
 * 
 * // Register all your routes first
 * app.use('/api', routes);
 * 
 * // Then register error handler as the LAST middleware
 * app.use(errorHandler); // Must be last middleware
 */

'use strict';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

/**
 * Current environment mode - defaults to 'development' if not set
 * @type {string}
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Whether the application is running in production mode
 * Used to determine level of error detail exposure
 * @type {boolean}
 */
const isProduction = NODE_ENV === 'production';

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Log error details to console for monitoring and debugging.
 * Includes timestamp, request path, error message, and optionally stack trace.
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @returns {void}
 */
const logError = (err, req) => {
  const timestamp = new Date().toISOString();
  const requestPath = req.originalUrl || req.path || 'unknown';
  const method = req.method || 'UNKNOWN';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const errorMessage = err.message || 'Unknown error';
  const statusCode = err.status || err.statusCode || 500;

  // Build log entry
  const logEntry = {
    timestamp,
    level: statusCode >= 500 ? 'ERROR' : 'WARN',
    method,
    path: requestPath,
    ip,
    statusCode,
    error: errorMessage
  };

  // Include stack trace in development mode only
  if (!isProduction && err.stack) {
    logEntry.stack = err.stack;
  }

  // Log to console.error for all errors (enables proper log level filtering)
  console.error(`[${logEntry.level}] ${timestamp} - ${method} ${requestPath} - Status: ${statusCode} - ${errorMessage}`);
  
  // In development, also log the full details
  if (!isProduction) {
    console.error('Error details:', JSON.stringify(logEntry, null, 2));
  }
};

// =============================================================================
// ERROR TYPE DETECTION UTILITIES
// =============================================================================

/**
 * Check if error is a rate limit error from express-rate-limit
 * 
 * @param {Error} err - The error object
 * @returns {boolean} True if this is a rate limit error
 */
const isRateLimitError = (err) => {
  // express-rate-limit sets status to 429
  if (err.status === 429 || err.statusCode === 429) {
    return true;
  }
  // Check for rateLimit property added by express-rate-limit
  if (err.rateLimit !== undefined) {
    return true;
  }
  // Check for specific error code
  if (err.code === 'RATE_LIMIT_EXCEEDED' || err.code === 'TOO_MANY_REQUESTS') {
    return true;
  }
  // Check error message
  if (err.message && err.message.toLowerCase().includes('too many requests')) {
    return true;
  }
  return false;
};

/**
 * Check if error is a validation error from express-validator
 * 
 * @param {Error} err - The error object
 * @returns {boolean} True if this is a validation error
 */
const isValidationError = (err) => {
  // Check for ValidationError name
  if (err.name === 'ValidationError') {
    return true;
  }
  // Check for validation-related status codes
  if ((err.status === 400 || err.statusCode === 400) && err.errors) {
    return true;
  }
  // Check for express-validator specific properties
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    // Check if errors look like express-validator format
    const firstError = err.errors[0];
    if (firstError && (firstError.param !== undefined || firstError.path !== undefined || firstError.msg !== undefined)) {
      return true;
    }
  }
  // Check for validation error code
  if (err.code === 'VALIDATION_ERROR' || err.code === 'VALIDATION_FAILED') {
    return true;
  }
  return false;
};

/**
 * Check if error is an authentication error (401)
 * 
 * @param {Error} err - The error object
 * @returns {boolean} True if this is an authentication error
 */
const isAuthenticationError = (err) => {
  if (err.status === 401 || err.statusCode === 401) {
    return true;
  }
  if (err.code === 'UNAUTHORIZED' || err.code === 'AUTH_REQUIRED' || err.code === 'AUTHENTICATION_FAILED') {
    return true;
  }
  if (err.name === 'UnauthorizedError' || err.name === 'AuthenticationError') {
    return true;
  }
  return false;
};

/**
 * Check if error is an authorization/forbidden error (403)
 * 
 * @param {Error} err - The error object
 * @returns {boolean} True if this is an authorization error
 */
const isAuthorizationError = (err) => {
  if (err.status === 403 || err.statusCode === 403) {
    return true;
  }
  if (err.code === 'FORBIDDEN' || err.code === 'ACCESS_DENIED' || err.code === 'AUTHORIZATION_FAILED') {
    return true;
  }
  if (err.name === 'ForbiddenError' || err.name === 'AuthorizationError') {
    return true;
  }
  return false;
};

/**
 * Check if error is a JSON syntax error (malformed request body)
 * 
 * @param {Error} err - The error object
 * @returns {boolean} True if this is a JSON syntax error
 */
const isSyntaxError = (err) => {
  return err instanceof SyntaxError && err.status === 400 && 'body' in err;
};

// =============================================================================
// ERROR RESPONSE HANDLERS
// =============================================================================

/**
 * Handle rate limit exceeded errors (429 Too Many Requests)
 * 
 * @param {Error} err - The error object
 * @param {Object} res - Express response object
 * @returns {void}
 */
const handleRateLimitError = (err, res) => {
  // Calculate retry after seconds if available
  let retryAfter = null;
  
  if (err.retryAfter) {
    retryAfter = err.retryAfter;
  } else if (err.rateLimit && err.rateLimit.resetTime) {
    retryAfter = Math.ceil((err.rateLimit.resetTime - Date.now()) / 1000);
  } else if (res.getHeader('Retry-After')) {
    retryAfter = parseInt(res.getHeader('Retry-After'), 10);
  }

  // Ensure Retry-After header is set
  if (retryAfter && retryAfter > 0) {
    res.set('Retry-After', String(retryAfter));
  }

  const response = {
    success: false,
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.'
  };

  if (retryAfter && retryAfter > 0) {
    response.retryAfter = retryAfter;
  }

  res.status(429).json(response);
};

/**
 * Handle validation errors (400 Bad Request)
 * 
 * @param {Error} err - The error object
 * @param {Object} res - Express response object
 * @returns {void}
 */
const handleValidationError = (err, res) => {
  // Format validation errors for response
  let details = [];

  if (Array.isArray(err.errors)) {
    details = err.errors.map(error => ({
      field: error.path || error.param || error.field || 'unknown',
      message: error.msg || error.message || 'Invalid value',
      value: isProduction ? undefined : error.value
    }));
  } else if (err.details) {
    details = err.details;
  }

  const response = {
    success: false,
    error: 'Validation failed',
    message: err.message || 'The request contains invalid data'
  };

  // Only include details array if there are validation errors
  if (details.length > 0) {
    response.details = details;
  }

  res.status(400).json(response);
};

/**
 * Handle authentication errors (401 Unauthorized)
 * 
 * @param {Error} err - The error object
 * @param {Object} res - Express response object
 * @returns {void}
 */
const handleAuthenticationError = (err, res) => {
  // In production, do NOT expose detailed security error information
  const response = {
    success: false,
    error: 'Access denied',
    message: isProduction ? 'Authentication required' : (err.message || 'Authentication required')
  };

  res.status(401).json(response);
};

/**
 * Handle authorization errors (403 Forbidden)
 * 
 * @param {Error} err - The error object
 * @param {Object} res - Express response object
 * @returns {void}
 */
const handleAuthorizationError = (err, res) => {
  // In production, do NOT expose detailed security error information
  const response = {
    success: false,
    error: 'Access denied',
    message: isProduction ? 'You do not have permission to access this resource' : (err.message || 'Access denied')
  };

  res.status(403).json(response);
};

/**
 * Handle JSON syntax errors (400 Bad Request)
 * 
 * @param {Error} err - The error object
 * @param {Object} res - Express response object
 * @returns {void}
 */
const handleSyntaxError = (err, res) => {
  const response = {
    success: false,
    error: 'Invalid JSON',
    message: 'The request body contains invalid JSON syntax'
  };

  // In development, include more details about the syntax error
  if (!isProduction && err.message) {
    response.details = err.message;
  }

  res.status(400).json(response);
};

/**
 * Handle server errors (500 Internal Server Error)
 * 
 * @param {Error} err - The error object
 * @param {Object} res - Express response object
 * @returns {void}
 */
const handleServerError = (err, res) => {
  const response = {
    success: false,
    error: 'Internal server error'
  };

  // In production: Hide stack traces and detailed error messages
  // In development: Include stack trace and detailed information for debugging
  if (isProduction) {
    response.message = 'An unexpected error occurred. Please try again later.';
  } else {
    response.message = err.message || 'An unexpected error occurred';
    if (err.stack) {
      response.stack = err.stack.split('\n').map(line => line.trim());
    }
    if (err.code) {
      response.code = err.code;
    }
  }

  res.status(500).json(response);
};

// =============================================================================
// MAIN ERROR HANDLER MIDDLEWARE
// =============================================================================

/**
 * Centralized Express error handling middleware.
 * 
 * Handles various error types and returns standardized JSON responses.
 * Must be registered AFTER all routes in the Express application.
 * 
 * Error Types Handled:
 * - Rate Limit Errors (429): When express-rate-limit threshold is exceeded
 * - Validation Errors (400): From express-validator or custom validation
 * - Authentication Errors (401): When authentication is required but missing/invalid
 * - Authorization Errors (403): When user lacks permission
 * - Syntax Errors (400): Malformed JSON in request body
 * - Server Errors (500): All other unhandled errors
 * 
 * Response Format:
 * {
 *   success: false,
 *   error: string,        // Brief error description
 *   message: string,      // Detailed message (limited in production)
 *   details?: any,        // Additional details (validation errors, etc.)
 *   retryAfter?: number,  // Seconds until rate limit resets (for 429)
 *   stack?: string[]      // Stack trace (development only)
 * }
 * 
 * @param {Error} err - The error object passed from previous middleware/route
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Register as the LAST middleware in your Express app
 * const express = require('express');
 * const errorHandler = require('./middleware/errorHandler');
 * 
 * const app = express();
 * 
 * // Your middleware and routes
 * app.use(express.json());
 * app.use('/api', apiRoutes);
 * 
 * // Error handler MUST be last
 * app.use(errorHandler); // Must be last middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log all errors for monitoring purposes
  logError(err, req);

  // If response headers have already been sent, delegate to Express default handler
  // This prevents attempting to send a response twice
  if (res.headersSent) {
    return next(err);
  }

  // Set JSON content type for all error responses
  res.setHeader('Content-Type', 'application/json');

  // Handle specific error types in order of specificity

  // 1. Rate Limit Errors (429 Too Many Requests)
  if (isRateLimitError(err)) {
    return handleRateLimitError(err, res);
  }

  // 2. Validation Errors (400 Bad Request)
  if (isValidationError(err)) {
    return handleValidationError(err, res);
  }

  // 3. JSON Syntax Errors (400 Bad Request)
  if (isSyntaxError(err)) {
    return handleSyntaxError(err, res);
  }

  // 4. Authentication Errors (401 Unauthorized)
  if (isAuthenticationError(err)) {
    return handleAuthenticationError(err, res);
  }

  // 5. Authorization Errors (403 Forbidden)
  if (isAuthorizationError(err)) {
    return handleAuthorizationError(err, res);
  }

  // 6. Handle errors with explicit status codes
  const statusCode = err.status || err.statusCode || 500;

  // 6a. Client errors (4xx) - pass through with appropriate response
  if (statusCode >= 400 && statusCode < 500) {
    const response = {
      success: false,
      error: err.name || 'Client Error',
      message: err.message || 'A client error occurred'
    };

    // In production, sanitize certain messages
    if (isProduction && statusCode === 400) {
      response.message = 'Bad request';
    }

    return res.status(statusCode).json(response);
  }

  // 6b. Server errors (5xx) - treat as internal server error
  return handleServerError(err, res);
};

// =============================================================================
// NOT FOUND HANDLER
// =============================================================================

/**
 * 404 Not Found handler middleware.
 * 
 * Should be registered AFTER all routes but BEFORE errorHandler.
 * Catches requests that don't match any defined routes.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Register after all routes
 * app.use('/api', routes);
 * app.use(notFoundHandler); // Catches unmatched routes
 * app.use(errorHandler);    // Must be last
 */
const notFoundHandler = (req, res, next) => {
  const response = {
    success: false,
    error: 'Not Found',
    message: `The requested resource '${req.originalUrl}' was not found on this server`,
    method: req.method,
    path: req.originalUrl
  };

  // In production, don't expose path details
  if (isProduction) {
    delete response.path;
    response.message = 'The requested resource was not found';
  }

  res.status(404).json(response);
};

// =============================================================================
// ASYNC HANDLER UTILITY
// =============================================================================

/**
 * Async handler wrapper for Express route handlers.
 * 
 * Wraps async route handlers to automatically catch promise rejections
 * and forward them to the error handler middleware.
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped middleware function
 * 
 * @example
 * // Wrap async route handlers
 * app.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.find();
 *   res.json(users);
 * }));
 * 
 * // Errors are automatically caught and passed to errorHandler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// =============================================================================
// MODULE EXPORTS
// =============================================================================

/**
 * Export error handling utilities.
 * 
 * Usage:
 * - const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');
 * - app.use(notFoundHandler);  // After routes
 * - app.use(errorHandler);     // Must be last middleware
 * 
 * @exports {Object} Error handling utilities
 * @property {Function} errorHandler - Centralized error handler (must be last)
 * @property {Function} notFoundHandler - 404 handler (before errorHandler)
 * @property {Function} asyncHandler - Async wrapper for route handlers
 */
module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
