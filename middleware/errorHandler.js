/**
 * @fileoverview Centralized Error Handling Middleware
 * 
 * This module provides centralized error handling for the Express application.
 * It handles various error types including validation errors, rate limit errors,
 * and security-related errors with consistent response formatting.
 * 
 * Features:
 * - Standardized error response format
 * - Environment-aware error details
 * - Logging for monitoring and debugging
 * - Specific handling for security errors
 * 
 * @module middleware/errorHandler
 * @version 1.0.0
 */

'use strict';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

/**
 * Current environment mode
 * @type {string}
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Whether running in production
 * @type {boolean}
 */
const isProduction = NODE_ENV === 'production';

// =============================================================================
// ERROR RESPONSE FORMATTING
// =============================================================================

/**
 * Format error response based on error type and environment.
 * 
 * @param {Error} error - The error object
 * @param {boolean} includeStack - Whether to include stack trace
 * @returns {Object} Formatted error response
 */
const formatErrorResponse = (error, includeStack = false) => {
  const response = {
    error: error.name || 'Error',
    message: error.message || 'An unexpected error occurred',
    status: error.status || error.statusCode || 500,
  };

  // Add error code if available
  if (error.code) {
    response.code = error.code;
  }

  // Add validation details if available
  if (error.details) {
    response.details = error.details;
  }

  // Add stack trace in development
  if (includeStack && error.stack) {
    response.stack = error.stack.split('\n').map(line => line.trim());
  }

  return response;
};

// =============================================================================
// ERROR TYPE HANDLERS
// =============================================================================

/**
 * Handle CORS errors
 * 
 * @param {Error} error - CORS error
 * @param {Object} res - Express response object
 */
const handleCorsError = (error, res) => {
  console.warn('[CORS_ERROR]', error.message);
  
  res.status(403).json({
    error: 'CORS Error',
    message: 'Cross-origin request blocked by CORS policy',
    code: 'CORS_BLOCKED',
  });
};

/**
 * Handle rate limit errors
 * 
 * @param {Error} error - Rate limit error
 * @param {Object} res - Express response object
 */
const handleRateLimitError = (error, res) => {
  console.warn('[RATE_LIMIT_ERROR]', error.message);
  
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: error.retryAfter || 'See Retry-After header',
  });
};

/**
 * Handle validation errors
 * 
 * @param {Error} error - Validation error
 * @param {Object} res - Express response object
 */
const handleValidationError = (error, res) => {
  console.info('[VALIDATION_ERROR]', error.message);
  
  res.status(400).json({
    error: 'Validation Error',
    message: error.message || 'The request contains invalid data',
    code: 'VALIDATION_FAILED',
    details: error.details || [],
  });
};

/**
 * Handle syntax/JSON parsing errors
 * 
 * @param {Error} error - Syntax error
 * @param {Object} res - Express response object
 */
const handleSyntaxError = (error, res) => {
  console.warn('[SYNTAX_ERROR]', error.message);
  
  res.status(400).json({
    error: 'Bad Request',
    message: 'Invalid JSON syntax in request body',
    code: 'INVALID_JSON',
  });
};

/**
 * Handle authentication errors
 * 
 * @param {Error} error - Authentication error
 * @param {Object} res - Express response object
 */
const handleAuthError = (error, res) => {
  console.warn('[AUTH_ERROR]', error.message);
  
  res.status(401).json({
    error: 'Unauthorized',
    message: error.message || 'Authentication required',
    code: 'AUTH_REQUIRED',
  });
};

/**
 * Handle authorization/forbidden errors
 * 
 * @param {Error} error - Authorization error
 * @param {Object} res - Express response object
 */
const handleForbiddenError = (error, res) => {
  console.warn('[FORBIDDEN_ERROR]', error.message);
  
  res.status(403).json({
    error: 'Forbidden',
    message: error.message || 'You do not have permission to access this resource',
    code: 'ACCESS_DENIED',
  });
};

/**
 * Handle not found errors
 * 
 * @param {Error} error - Not found error
 * @param {Object} res - Express response object
 */
const handleNotFoundError = (error, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: error.message || 'The requested resource was not found',
    code: 'NOT_FOUND',
  });
};

// =============================================================================
// MAIN ERROR HANDLER MIDDLEWARE
// =============================================================================

/**
 * Centralized error handling middleware.
 * Catches all errors and returns standardized responses.
 * 
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Use as the last middleware in the chain
 * app.use(errorHandler);
 */
const errorHandler = (error, req, res, next) => {
  // Log error for monitoring
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    error: error.message,
    stack: isProduction ? undefined : error.stack,
  };
  
  console.error('[ERROR]', JSON.stringify(logData));

  // If headers already sent, delegate to default handler
  if (res.headersSent) {
    return next(error);
  }

  // Handle specific error types
  if (error.message && error.message.includes('CORS')) {
    return handleCorsError(error, res);
  }

  if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
    return handleRateLimitError(error, res);
  }

  if (error.name === 'ValidationError' || error.code === 'VALIDATION_FAILED') {
    return handleValidationError(error, res);
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return handleSyntaxError(error, res);
  }

  if (error.status === 401 || error.code === 'AUTH_REQUIRED') {
    return handleAuthError(error, res);
  }

  if (error.status === 403 || error.code === 'FORBIDDEN') {
    return handleForbiddenError(error, res);
  }

  if (error.status === 404 || error.code === 'NOT_FOUND') {
    return handleNotFoundError(error, res);
  }

  // Default error response
  const status = error.status || error.statusCode || 500;
  const response = formatErrorResponse(error, !isProduction);

  // Don't expose internal error details in production
  if (isProduction && status >= 500) {
    response.message = 'An internal server error occurred';
    delete response.stack;
    delete response.details;
  }

  res.status(status).json(response);
};

// =============================================================================
// 404 NOT FOUND HANDLER
// =============================================================================

/**
 * Handle 404 Not Found for unmatched routes.
 * Use before the error handler middleware.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * // Use before error handler
 * app.use(notFoundHandler);
 * app.use(errorHandler);
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
};

// =============================================================================
// ASYNC ERROR WRAPPER
// =============================================================================

/**
 * Wrap async route handlers to catch errors automatically.
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped middleware function
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.findAll();
 *   res.json(users);
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// =============================================================================
// MODULE EXPORTS
// =============================================================================

module.exports = {
  /**
   * Main error handler middleware
   */
  errorHandler,

  /**
   * 404 Not Found handler
   */
  notFoundHandler,

  /**
   * Async handler wrapper
   */
  asyncHandler,

  /**
   * Format error response
   */
  formatErrorResponse,

  /**
   * Environment info
   */
  env: {
    NODE_ENV,
    isProduction,
  },
};
