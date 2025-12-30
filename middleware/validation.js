/**
 * @fileoverview Express-validator Middleware Module
 * 
 * This module provides request validation schemas and middleware using
 * express-validator@7.3.1. It ensures all incoming data is properly validated
 * and sanitized before processing by route handlers.
 * 
 * Features:
 * - Schema-based validation for body, query, and params
 * - Automatic sanitization of input data (trim, escape)
 * - Standardized error response format
 * - Reusable validation chains for common patterns
 * 
 * Usage:
 * This middleware should be applied per-route, not globally.
 * 
 * @example
 * const { validateRequest, validationSchemas } = require('./middleware/validation');
 * 
 * // Apply validation to a specific route
 * app.post('/user',
 *   validationSchemas.validateEmail,
 *   validateRequest,
 *   (req, res) => { ... }
 * );
 * 
 * // Chain multiple validations
 * app.post('/register',
 *   ...validationSchemas.sanitizeBody,
 *   ...validationSchemas.validateEmail,
 *   ...validationSchemas.validateString('username', { min: 3, max: 50 }),
 *   validateRequest,
 *   registerHandler
 * );
 * 
 * @module middleware/validation
 * @version 1.0.0
 * @requires express-validator
 */

'use strict';

// =============================================================================
// IMPORTS
// =============================================================================

const { body, query, param, validationResult } = require('express-validator');

// =============================================================================
// VALIDATION RESULT HANDLER
// =============================================================================

/**
 * Middleware to handle validation results from express-validator.
 * 
 * This middleware collects all validation errors from the request and:
 * - If errors exist: Returns 400 status with detailed JSON error response
 * - If no errors: Calls next() to continue the middleware chain
 * 
 * Error Response Format:
 * {
 *   success: false,
 *   errors: [
 *     {
 *       field: "email",
 *       message: "Invalid email format",
 *       value: "invalid-email",
 *       location: "body"
 *     }
 *   ]
 * }
 * 
 * @function validateRequest
 * @param {Object} req - Express request object containing validation errors
 * @param {Object} res - Express response object for sending error responses
 * @param {Function} next - Express next middleware function
 * @returns {void|Object} Returns JSON error response on validation failure, or calls next()
 * 
 * @example
 * // Basic usage with a single validation
 * app.post('/users',
 *   body('email').isEmail(),
 *   validateRequest,
 *   createUserHandler
 * );
 * 
 * @example
 * // Usage with validation schema
 * app.post('/users',
 *   validationSchemas.validateEmail,
 *   validateRequest,
 *   createUserHandler
 * );
 */
const validateRequest = (req, res, next) => {
  // Collect all validation errors from the request
  const errors = validationResult(req);

  // Check if there are any validation errors
  if (!errors.isEmpty()) {
    // Format errors consistently for API response
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param || error.type,
      message: error.msg,
      value: error.value !== undefined ? error.value : null,
      location: error.location || 'unknown',
    }));

    // Return 400 Bad Request with detailed error information
    return res.status(400).json({
      success: false,
      errors: formattedErrors,
    });
  }

  // No validation errors, proceed to next middleware/handler
  next();
};

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Collection of reusable validation chains for common input validation patterns.
 * 
 * Each schema is an array of express-validator validation chains that can be
 * spread into route middleware or used directly.
 * 
 * @namespace validationSchemas
 * @type {Object}
 * 
 * @property {Array} sanitizeBody - Trims whitespace and escapes HTML entities in body fields
 * @property {Array} validateId - Validates route param 'id' as a positive integer
 * @property {Array} validateEmail - Validates body 'email' field as valid email format
 * @property {Function} validateString - Factory function for string validation with constraints
 * @property {Array} validateJson - Validates body contains valid JSON structure
 * 
 * @example
 * // Using sanitizeBody to clean all string inputs
 * app.post('/message',
 *   ...validationSchemas.sanitizeBody,
 *   validateRequest,
 *   handleMessage
 * );
 * 
 * @example
 * // Using validateId for resource endpoints
 * app.get('/users/:id',
 *   validationSchemas.validateId,
 *   validateRequest,
 *   getUser
 * );
 * 
 * @example
 * // Using validateEmail for user registration
 * app.post('/register',
 *   validationSchemas.validateEmail,
 *   validateRequest,
 *   registerUser
 * );
 * 
 * @example
 * // Using validateString with custom constraints
 * app.post('/profile',
 *   validationSchemas.validateString('username', { min: 3, max: 30, required: true }),
 *   validationSchemas.validateString('bio', { max: 500 }),
 *   validateRequest,
 *   updateProfile
 * );
 */
const validationSchemas = {
  /**
   * Sanitizes all common body fields by trimming whitespace and escaping HTML entities.
   * 
   * This validation chain should be applied to any route that accepts user input
   * to prevent XSS attacks and normalize input data.
   * 
   * Actions performed:
   * - Trims leading and trailing whitespace from string fields
   * - Escapes HTML special characters (&, <, >, ", ') to prevent XSS
   * 
   * @type {Array}
   * @memberof validationSchemas
   * 
   * @example
   * app.post('/comment',
   *   ...validationSchemas.sanitizeBody,
   *   validateRequest,
   *   (req, res) => {
   *     // req.body fields are now trimmed and escaped
   *     const { content } = req.body;
   *   }
   * );
   */
  sanitizeBody: [
    // Sanitize common text fields - trim whitespace
    body('*')
      .optional()
      .trim(),
    // Sanitize and escape any 'content' field
    body('content')
      .optional()
      .trim()
      .escape(),
    // Sanitize and escape any 'message' field
    body('message')
      .optional()
      .trim()
      .escape(),
    // Sanitize and escape any 'text' field
    body('text')
      .optional()
      .trim()
      .escape(),
    // Sanitize and escape any 'name' field
    body('name')
      .optional()
      .trim()
      .escape(),
    // Sanitize and escape any 'title' field
    body('title')
      .optional()
      .trim()
      .escape(),
    // Sanitize and escape any 'description' field
    body('description')
      .optional()
      .trim()
      .escape(),
  ],

  /**
   * Validates the 'id' route parameter as a positive integer.
   * 
   * This validation ensures that resource ID parameters are valid integers,
   * which is essential for database queries and resource identification.
   * 
   * Validation rules:
   * - Must be present (not empty)
   * - Must be a valid integer
   * - Must be positive (>= 1)
   * - Converts to integer type after validation
   * 
   * @type {Array}
   * @memberof validationSchemas
   * 
   * @example
   * // Validate ID in GET request
   * app.get('/users/:id',
   *   validationSchemas.validateId,
   *   validateRequest,
   *   (req, res) => {
   *     const userId = req.params.id; // Now guaranteed to be a positive integer
   *   }
   * );
   * 
   * @example
   * // Validate ID in DELETE request
   * app.delete('/posts/:id',
   *   validationSchemas.validateId,
   *   validateRequest,
   *   deletePost
   * );
   */
  validateId: [
    param('id')
      .notEmpty()
      .withMessage('ID parameter is required')
      .isInt({ min: 1 })
      .withMessage('ID must be a positive integer')
      .toInt(),
  ],

  /**
   * Validates the 'email' body field as a properly formatted email address.
   * 
   * This validation ensures email addresses are valid and properly normalized
   * for storage and communication purposes.
   * 
   * Validation rules:
   * - Must be present and not empty
   * - Must be a valid email format (RFC 5322)
   * - Trims whitespace before validation
   * - Normalizes email (lowercase, removes dots from gmail local part, etc.)
   * 
   * @type {Array}
   * @memberof validationSchemas
   * 
   * @example
   * // Validate email in registration
   * app.post('/register',
   *   validationSchemas.validateEmail,
   *   validateRequest,
   *   (req, res) => {
   *     const { email } = req.body; // Validated and normalized email
   *   }
   * );
   * 
   * @example
   * // Combine with other validations
   * app.post('/subscribe',
   *   validationSchemas.validateEmail,
   *   validationSchemas.validateString('name', { required: true }),
   *   validateRequest,
   *   subscribeUser
   * );
   */
  validateEmail: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email address is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false,
      }),
  ],

  /**
   * Factory function that creates a validation chain for string fields with configurable constraints.
   * 
   * This flexible validator allows you to create custom string validation rules
   * for any body field with specified length constraints and requirements.
   * 
   * Options:
   * @param {string} fieldName - The name of the body field to validate
   * @param {Object} [options={}] - Validation configuration options
   * @param {boolean} [options.required=false] - Whether the field is required
   * @param {number} [options.min] - Minimum string length
   * @param {number} [options.max] - Maximum string length (default: 1000)
   * @param {boolean} [options.escape=true] - Whether to escape HTML entities
   * @returns {Array} Array of validation chains for the specified field
   * 
   * @function validateString
   * @memberof validationSchemas
   * 
   * @example
   * // Required username with length constraints
   * app.post('/profile',
   *   validationSchemas.validateString('username', { required: true, min: 3, max: 30 }),
   *   validateRequest,
   *   updateProfile
   * );
   * 
   * @example
   * // Optional bio field with max length
   * app.post('/profile',
   *   validationSchemas.validateString('bio', { max: 500 }),
   *   validateRequest,
   *   updateProfile
   * );
   * 
   * @example
   * // Multiple string fields
   * app.post('/post',
   *   validationSchemas.validateString('title', { required: true, min: 5, max: 100 }),
   *   validationSchemas.validateString('content', { required: true, min: 10, max: 5000 }),
   *   validationSchemas.validateString('tags', { max: 200 }),
   *   validateRequest,
   *   createPost
   * );
   */
  validateString: (fieldName, options = {}) => {
    const {
      required = false,
      min,
      max = 1000,
      escape: shouldEscape = true,
    } = options;

    // Build the validation chain
    let chain = body(fieldName).trim();

    // Handle required vs optional
    if (required) {
      chain = chain
        .notEmpty()
        .withMessage(`${fieldName} is required`);
    } else {
      chain = chain.optional({ values: 'falsy' });
    }

    // Add length constraints
    const lengthOptions = {};
    if (min !== undefined) {
      lengthOptions.min = min;
    }
    if (max !== undefined) {
      lengthOptions.max = max;
    }

    if (Object.keys(lengthOptions).length > 0) {
      let lengthMessage = '';
      if (min !== undefined && max !== undefined) {
        lengthMessage = `${fieldName} must be between ${min} and ${max} characters`;
      } else if (min !== undefined) {
        lengthMessage = `${fieldName} must be at least ${min} characters`;
      } else if (max !== undefined) {
        lengthMessage = `${fieldName} must not exceed ${max} characters`;
      }

      chain = chain.isLength(lengthOptions).withMessage(lengthMessage);
    }

    // Escape HTML entities to prevent XSS
    if (shouldEscape) {
      chain = chain.escape();
    }

    return [chain];
  },

  /**
   * Validates that the request body contains a valid JSON structure.
   * 
   * This validation ensures the request body is properly formed JSON,
   * which is essential for API endpoints that expect structured data.
   * 
   * Validation rules:
   * - Body must be an object (not null, array, or primitive)
   * - Performs type checking on the parsed body
   * 
   * Note: This validation assumes express.json() middleware has already
   * parsed the request body. It validates the structure, not the parsing.
   * 
   * @type {Array}
   * @memberof validationSchemas
   * 
   * @example
   * // Ensure valid JSON body structure
   * app.post('/data',
   *   express.json(),
   *   validationSchemas.validateJson,
   *   validateRequest,
   *   (req, res) => {
   *     // req.body is guaranteed to be a valid object
   *   }
   * );
   * 
   * @example
   * // Combine with other validations
   * app.post('/api/resource',
   *   validationSchemas.validateJson,
   *   validationSchemas.validateString('type', { required: true }),
   *   validateRequest,
   *   createResource
   * );
   */
  validateJson: [
    body()
      .custom((value, { req }) => {
        // Check if body exists and is a plain object
        if (req.body === undefined || req.body === null) {
          throw new Error('Request body is required');
        }

        // Check if body is an object (not an array or primitive)
        if (typeof req.body !== 'object' || Array.isArray(req.body)) {
          throw new Error('Request body must be a JSON object');
        }

        // Check for common malformed JSON indicators
        if (req.body.constructor !== Object) {
          throw new Error('Request body must be a plain JSON object');
        }

        return true;
      }),
  ],
};

// =============================================================================
// MODULE EXPORTS
// =============================================================================

/**
 * Export validation middleware and schemas for use in Express routes.
 * 
 * @exports middleware/validation
 * @type {Object}
 * @property {Function} validateRequest - Middleware to handle validation results
 * @property {Object} validationSchemas - Collection of reusable validation schemas
 * 
 * @example
 * // Import in route file
 * const { validateRequest, validationSchemas } = require('./middleware/validation');
 * 
 * // Apply to routes
 * app.post('/user',
 *   validationSchemas.validateEmail,
 *   validateRequest,
 *   createUserHandler
 * );
 * 
 * app.get('/user/:id',
 *   validationSchemas.validateId,
 *   validateRequest,
 *   getUserHandler
 * );
 * 
 * app.post('/message',
 *   ...validationSchemas.sanitizeBody,
 *   validationSchemas.validateString('content', { required: true, max: 1000 }),
 *   validationSchemas.validateJson,
 *   validateRequest,
 *   sendMessageHandler
 * );
 */
module.exports = {
  validateRequest,
  validationSchemas,
};
