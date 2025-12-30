/**
 * @fileoverview HTTPS/TLS Server Configuration Module
 * 
 * This module provides configuration and helper functions for creating
 * an HTTPS server with TLS encryption. It handles certificate loading
 * and secure server creation.
 * 
 * Environment Variables:
 * - HTTPS_PORT: Port for HTTPS server (default: 3443)
 * - SSL_KEY_PATH: Path to SSL private key (default: ./certs/server.key)
 * - SSL_CERT_PATH: Path to SSL certificate (default: ./certs/server.cert)
 * - HTTPS_ENABLED: Whether to enable HTTPS (default: true in production)
 * 
 * @module config/https
 * @version 1.0.0
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// =============================================================================
// ENVIRONMENT VARIABLES
// =============================================================================

/**
 * HTTPS server port
 * @type {number}
 */
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT, 10) || 3443;

/**
 * HTTP server port (for redirect)
 * @type {number}
 */
const HTTP_PORT = parseInt(process.env.HTTP_PORT, 10) || 3000;

/**
 * Path to SSL private key file
 * @type {string}
 */
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(process.cwd(), 'certs', 'server.key');

/**
 * Path to SSL certificate file
 * @type {string}
 */
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(process.cwd(), 'certs', 'server.cert');

/**
 * Whether HTTPS is enabled
 * @type {boolean}
 */
const HTTPS_ENABLED = process.env.HTTPS_ENABLED !== 'false' && 
                       (process.env.NODE_ENV === 'production' || 
                        process.env.HTTPS_ENABLED === 'true' ||
                        process.argv.includes('--https'));

// =============================================================================
// SSL CERTIFICATE LOADING
// =============================================================================

/**
 * Check if SSL certificates exist
 * 
 * @returns {boolean} True if both key and cert files exist
 */
const certificatesExist = () => {
  try {
    return fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);
  } catch (error) {
    console.warn('[HTTPS] Error checking certificates:', error.message);
    return false;
  }
};

/**
 * Load SSL certificates from disk
 * 
 * @returns {Object|null} Object with key and cert, or null if not found
 * @throws {Error} If certificates exist but cannot be read
 */
const loadCertificates = () => {
  if (!certificatesExist()) {
    console.warn('[HTTPS] SSL certificates not found at:');
    console.warn(`  Key:  ${SSL_KEY_PATH}`);
    console.warn(`  Cert: ${SSL_CERT_PATH}`);
    console.warn('[HTTPS] Run the following to generate self-signed certificates:');
    console.warn('  openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.cert -days 365 -nodes -subj "/CN=localhost"');
    return null;
  }

  try {
    return {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH),
    };
  } catch (error) {
    throw new Error(`[HTTPS] Failed to load SSL certificates: ${error.message}`);
  }
};

// =============================================================================
// HTTPS OPTIONS
// =============================================================================

/**
 * HTTPS server options for TLS configuration.
 * 
 * @type {Object}
 * @property {Buffer|null} key - SSL private key
 * @property {Buffer|null} cert - SSL certificate
 * @property {string[]} secureProtocol - Minimum TLS version
 * 
 * @security
 * - Uses TLS 1.2 as minimum for security
 * - Certificates should be from trusted CA in production
 * - Self-signed certificates only for development
 */
const getHttpsOptions = () => {
  const certs = loadCertificates();
  
  if (!certs) {
    return null;
  }

  return {
    key: certs.key,
    cert: certs.cert,
    // Minimum TLS 1.2 for security
    minVersion: 'TLSv1.2',
    // Prefer server cipher suites
    honorCipherOrder: true,
  };
};

// =============================================================================
// SECURE SERVER CREATION
// =============================================================================

/**
 * Create an HTTPS server with the Express application.
 * 
 * @param {Object} app - Express application instance
 * @returns {Object|null} HTTPS server instance, or null if HTTPS not available
 * 
 * @example
 * const express = require('express');
 * const { createSecureServer } = require('./config/https');
 * const app = express();
 * const httpsServer = createSecureServer(app);
 * if (httpsServer) {
 *   httpsServer.listen(3443);
 * }
 */
const createSecureServer = (app) => {
  const httpsOptions = getHttpsOptions();
  
  if (!httpsOptions) {
    console.warn('[HTTPS] Cannot create secure server - certificates not available');
    return null;
  }

  return https.createServer(httpsOptions, app);
};

/**
 * Create HTTP redirect middleware for HTTPS enforcement.
 * Redirects all HTTP requests to HTTPS.
 * 
 * @param {number} [httpsPort] - HTTPS port to redirect to
 * @returns {Function} Express middleware function
 * 
 * @example
 * const { createHttpsRedirect } = require('./config/https');
 * httpApp.use(createHttpsRedirect(3443));
 */
const createHttpsRedirect = (httpsPort = HTTPS_PORT) => {
  return (req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }
    
    const host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
    const redirectUrl = `https://${host}:${httpsPort}${req.url}`;
    
    res.redirect(301, redirectUrl);
  };
};

// =============================================================================
// MODULE EXPORTS
// =============================================================================

module.exports = {
  /**
   * Get HTTPS options for server creation
   */
  getHttpsOptions,

  /**
   * Create an HTTPS server with Express app
   */
  createSecureServer,

  /**
   * Create HTTP to HTTPS redirect middleware
   */
  createHttpsRedirect,

  /**
   * Check if SSL certificates exist
   */
  certificatesExist,

  /**
   * Load SSL certificates from disk
   */
  loadCertificates,

  /**
   * Environment configuration
   */
  env: {
    HTTPS_PORT,
    HTTP_PORT,
    SSL_KEY_PATH,
    SSL_CERT_PATH,
    HTTPS_ENABLED,
  },
};
