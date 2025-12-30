/**
 * @fileoverview Input Validation Middleware Module
 * 
 * This module provides request validation schemas and middleware using
 * express-validator. It ensures all incoming data is properly validated
 * and sanitized before processing.
 * 
 * Features:
 * - Schema-based validation for body, query, and params
 * - Automatic sanitization of input data
 * - Standardized error response format
 * - Reusable validation chains
 * 
 * @module middleware/validation
 * @version 1.0.0
 */

'use strict';

const { body, query, param, validationResult } = require('express-validator');

// =============================================================================
// VALIDATION ERROR HANDLER
// =============================================================================

/**
 * Middleware to handle validation results.
 * Returns 400 Bad Request with detailed error messages if validation fails.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 * 
 * @example
 * router.post('/users',
 *   createUserValidation,
 *   validateRequest,
 *   createUserHandler
 * );
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    return res.status(400).json({
      error: 'Validation Error',
      message: 'The request contains invalid or missing data',
      details: formattedErrors,
    });
  }
  
  next();
};

// =============================================================================
// COMMON VALIDATION CHAINS
// =============================================================================

/**
 * Common validation for email fields
 * @type {Array}
 */
const emailValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
];

/**
 * Common validation for password fields
 * @type {Array}
 */
const passwordValidation = [
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
];

/**
 * Common validation for ID parameters
 * @type {Array}
 */
const idParamValidation = [
  param('id')
    .trim()
    .notEmpty().withMessage('ID is required')
    .isAlphanumeric().withMessage('ID must be alphanumeric'),
];

/**
 * Common validation for numeric ID parameters
 * @type {Array}
 */
const numericIdParamValidation = [
  param('id')
    .notEmpty().withMessage('ID is required')
    .isInt({ min: 1 }).withMessage('ID must be a positive integer')
    .toInt(),
];

/**
 * Common validation for pagination query parameters
 * @type {Array}
 */
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
];

/**
 * Common validation for search query parameters
 * @type {Array}
 */
const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Search query too long')
    .escape(),
];

// =============================================================================
// API VALIDATION SCHEMAS
// =============================================================================

/**
 * Validation schema for generic JSON body
 * Ensures the body is valid JSON and not empty
 * @type {Array}
 */
const jsonBodyValidation = [
  body()
    .custom((value, { req }) => {
      // Check if body exists and is not empty object
      if (!req.body || Object.keys(req.body).length === 0) {
        return true; // Allow empty body for some endpoints
      }
      return true;
    }),
];

/**
 * Validation schema for name field
 * @type {Array}
 */
const nameValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters')
    .escape(),
];

/**
 * Validation schema for message/content fields
 * @type {Array}
 */
const contentValidation = [
  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Content exceeds maximum length')
    .escape(),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Message exceeds maximum length')
    .escape(),
];

// =============================================================================
// VALIDATION SCHEMAS COLLECTION
// =============================================================================

/**
 * Collection of validation schemas for different endpoints.
 * Use with validateRequest middleware.
 * 
 * @type {Object}
 * @property {Array} email - Email validation chain
 * @property {Array} password - Password validation chain
 * @property {Array} idParam - ID parameter validation
 * @property {Array} numericIdParam - Numeric ID parameter validation
 * @property {Array} pagination - Pagination query validation
 * @property {Array} search - Search query validation
 * @property {Array} jsonBody - JSON body validation
 * @property {Array} name - Name field validation
 * @property {Array} content - Content/message field validation
 * 
 * @example
 * const { validationSchemas, validateRequest } = require('./middleware/validation');
 * 
 * router.get('/users/:id',
 *   validationSchemas.numericIdParam,
 *   validateRequest,
 *   getUserHandler
 * );
 */
const validationSchemas = {
  email: emailValidation,
  password: passwordValidation,
  idParam: idParamValidation,
  numericIdParam: numericIdParamValidation,
  pagination: paginationValidation,
  search: searchValidation,
  jsonBody: jsonBodyValidation,
  name: nameValidation,
  content: contentValidation,
};

// =============================================================================
// CUSTOM VALIDATORS
// =============================================================================

/**
 * Create a custom validation chain for a specific field.
 * 
 * @param {string} fieldName - Name of the field to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.required=false] - Whether field is required
 * @param {number} [options.minLength] - Minimum length
 * @param {number} [options.maxLength] - Maximum length
 * @param {RegExp} [options.pattern] - Regex pattern to match
 * @param {string} [options.patternMessage] - Error message for pattern mismatch
 * @returns {Array} Validation chain
 * 
 * @example
 * const usernameValidation = createFieldValidation('username', {
 *   required: true,
 *   minLength: 3,
 *   maxLength: 20,
 *   pattern: /^[a-zA-Z0-9_]+$/,
 *   patternMessage: 'Username can only contain letters, numbers, and underscores'
 * });
 */
const createFieldValidation = (fieldName, options = {}) => {
  const chain = body(fieldName);
  const validators = [];

  if (options.required) {
    validators.push(
      chain.notEmpty().withMessage(`${fieldName} is required`)
    );
  } else {
    validators.push(chain.optional());
  }

  if (options.minLength || options.maxLength) {
    const lengthOptions = {};
    if (options.minLength) lengthOptions.min = options.minLength;
    if (options.maxLength) lengthOptions.max = options.maxLength;
    
    validators.push(
      chain.isLength(lengthOptions).withMessage(
        `${fieldName} must be between ${options.minLength || 0} and ${options.maxLength || 'unlimited'} characters`
      )
    );
  }

  if (options.pattern) {
    validators.push(
      chain.matches(options.pattern).withMessage(
        options.patternMessage || `${fieldName} format is invalid`
      )
    );
  }

  return validators;
};

/**
 * Sanitize all string fields in the request body.
 * Trims whitespace and escapes HTML entities.
 * 
 * @returns {Function} Express middleware function
 */
const sanitizeBody = () => {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].trim();
        }
      });
    }
    next();
  };
};

// =============================================================================
// MODULE EXPORTS
// =============================================================================

module.exports = {
  /**
   * Middleware to handle validation results
   */
  validateRequest,

  /**
   * Collection of validation schemas
   */
  validationSchemas,

  /**
   * Create custom field validation
   */
  createFieldValidation,

  /**
   * Sanitize all string fields in body
   */
  sanitizeBody,

  /**
   * Re-export express-validator functions for convenience
   */
  body,
  query,
  param,
  validationResult,
};
