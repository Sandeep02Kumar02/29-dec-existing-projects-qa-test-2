/**
 * @fileoverview HTTPS/TLS Server Configuration Module
 * 
 * This module provides HTTPS/TLS server configuration for secure communications.
 * It exports httpsOptions object for TLS settings and createSecureServer function
 * for creating HTTPS servers with Express applications.
 * 
 * Environment Variables:
 * - SSL_KEY_PATH: Path to SSL private key file (default: ./certs/server.key)
 * - SSL_CERT_PATH: Path to SSL certificate file (default: ./certs/server.cert)
 * - HTTPS_PORT: HTTPS server port (default: 3443)
 * 
 * Security Requirements:
 * - TLS 1.2 minimum version enforced for all connections
 * - Certificates should be from trusted CA in production
 * - Self-signed certificates acceptable only for development
 * 
 * @module config/https
 * @version 1.0.0
 * @author Blitzy Security Hardening
 */

'use strict';

// =============================================================================
// IMPORTS
// =============================================================================

/**
 * Node.js built-in file system module for reading SSL certificate files
 */
const fs = require('fs');

/**
 * Node.js built-in path module for resolving certificate file paths
 */
const path = require('path');

/**
 * Node.js built-in HTTPS module for creating secure TLS/SSL servers
 */
const https = require('https');

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

/**
 * Path to SSL private key file
 * Configurable via SSL_KEY_PATH environment variable
 * @type {string}
 */
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.resolve(process.cwd(), 'certs', 'server.key');

/**
 * Path to SSL certificate file
 * Configurable via SSL_CERT_PATH environment variable
 * @type {string}
 */
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.resolve(process.cwd(), 'certs', 'server.cert');

/**
 * HTTPS server port
 * Configurable via HTTPS_PORT environment variable
 * @type {number}
 */
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT, 10) || 3443;

// =============================================================================
// CERTIFICATE LOADING
// =============================================================================

/**
 * Load SSL certificates from configured file paths.
 * 
 * Reads the SSL private key and certificate files from the paths specified
 * in environment variables (SSL_KEY_PATH, SSL_CERT_PATH) or defaults to
 * ./certs/server.key and ./certs/server.cert respectively.
 * 
 * @function loadCertificates
 * @returns {Object|null} Object containing key and cert buffers, or null if certificates unavailable
 * @returns {Buffer} return.key - SSL private key content
 * @returns {Buffer} return.cert - SSL certificate content
 * 
 * @example
 * const certs = loadCertificates();
 * if (certs) {
 *   console.log('Certificates loaded successfully');
 * } else {
 *   console.log('Certificates not available');
 * }
 * 
 * @security
 * - Validates file existence before attempting to read
 * - Provides clear error messages for troubleshooting
 * - Does not expose sensitive certificate content in logs
 */
function loadCertificates() {
  // Check if certificate files exist before attempting to read
  const keyExists = fs.existsSync(SSL_KEY_PATH);
  const certExists = fs.existsSync(SSL_CERT_PATH);

  if (!keyExists || !certExists) {
    // Log helpful information about missing certificates
    console.warn('[HTTPS Config] SSL certificates not found:');
    
    if (!keyExists) {
      console.warn(`  - Private key not found at: ${SSL_KEY_PATH}`);
    }
    
    if (!certExists) {
      console.warn(`  - Certificate not found at: ${SSL_CERT_PATH}`);
    }
    
    console.warn('[HTTPS Config] To generate self-signed certificates for development:');
    console.warn('  mkdir -p certs');
    console.warn('  openssl req -x509 -newkey rsa:4096 \\');
    console.warn('    -keyout certs/server.key \\');
    console.warn('    -out certs/server.cert \\');
    console.warn('    -days 365 -nodes \\');
    console.warn('    -subj "/CN=localhost"');
    
    return null;
  }

  try {
    // Read certificate files synchronously
    const key = fs.readFileSync(SSL_KEY_PATH);
    const cert = fs.readFileSync(SSL_CERT_PATH);

    console.log('[HTTPS Config] SSL certificates loaded successfully');
    console.log(`  - Key: ${SSL_KEY_PATH}`);
    console.log(`  - Cert: ${SSL_CERT_PATH}`);

    return {
      key: key,
      cert: cert
    };
  } catch (error) {
    // Handle file read errors gracefully
    console.error('[HTTPS Config] Error reading SSL certificates:');
    console.error(`  ${error.message}`);
    
    if (error.code === 'EACCES') {
      console.error('[HTTPS Config] Permission denied. Check file permissions for:');
      console.error(`  - ${SSL_KEY_PATH}`);
      console.error(`  - ${SSL_CERT_PATH}`);
    } else if (error.code === 'ENOENT') {
      console.error('[HTTPS Config] File not found. Verify paths are correct.');
    }
    
    return null;
  }
}

// =============================================================================
// HTTPS OPTIONS CONFIGURATION
// =============================================================================

/**
 * HTTPS server options for TLS configuration.
 * 
 * This object contains the TLS configuration settings required for creating
 * secure HTTPS connections. It includes the SSL private key, certificate,
 * and minimum TLS version requirement.
 * 
 * @type {Object}
 * @property {Buffer|null} key - SSL private key content loaded from SSL_KEY_PATH
 * @property {Buffer|null} cert - SSL certificate content loaded from SSL_CERT_PATH
 * @property {string} minVersion - Minimum TLS version ('TLSv1.2' for security)
 * 
 * @security
 * - minVersion set to 'TLSv1.2' to prevent downgrade attacks
 * - TLS 1.0 and 1.1 are deprecated and vulnerable
 * - In production, use certificates from trusted Certificate Authority
 * 
 * @example
 * const { httpsOptions } = require('./config/https');
 * if (httpsOptions.key && httpsOptions.cert) {
 *   const server = https.createServer(httpsOptions, app);
 * }
 */
const httpsOptions = (function() {
  // Load certificates on module initialization
  const certs = loadCertificates();
  
  // Return configuration object with loaded certificates
  return {
    /**
     * SSL private key content
     * @type {Buffer|null}
     */
    key: certs ? certs.key : null,
    
    /**
     * SSL certificate content
     * @type {Buffer|null}
     */
    cert: certs ? certs.cert : null,
    
    /**
     * Minimum TLS version requirement
     * Set to TLS 1.2 for security compliance
     * @type {string}
     */
    minVersion: 'TLSv1.2'
  };
})();

// =============================================================================
// SECURE SERVER CREATION
// =============================================================================

/**
 * Create an HTTPS server with the provided Express application.
 * 
 * This function creates a secure HTTPS server using the configured TLS options
 * and the provided Express application instance. It handles certificate
 * availability checks and provides graceful error handling.
 * 
 * @function createSecureServer
 * @param {Object} app - Express application instance to attach to the HTTPS server
 * @returns {https.Server|null} HTTPS server instance, or null if certificates are unavailable
 * 
 * @example
 * const express = require('express');
 * const { createSecureServer } = require('./config/https');
 * 
 * const app = express();
 * app.get('/', (req, res) => res.send('Secure Hello!'));
 * 
 * const httpsServer = createSecureServer(app);
 * if (httpsServer) {
 *   httpsServer.listen(3443, () => {
 *     console.log('HTTPS server running on port 3443');
 *   });
 * } else {
 *   console.log('HTTPS not available - running HTTP only');
 * }
 * 
 * @security
 * - Returns null instead of throwing if certificates unavailable
 * - Allows graceful fallback to HTTP-only mode in development
 * - Production should always require valid certificates
 */
function createSecureServer(app) {
  // Validate that app parameter is provided
  if (!app) {
    console.error('[HTTPS Config] createSecureServer requires an Express app instance');
    return null;
  }

  // Check if certificates are available
  if (!httpsOptions.key || !httpsOptions.cert) {
    console.warn('[HTTPS Config] Cannot create secure server - SSL certificates not available');
    console.warn('[HTTPS Config] Server will run in HTTP-only mode');
    console.warn('[HTTPS Config] Set SSL_KEY_PATH and SSL_CERT_PATH environment variables or generate certificates');
    return null;
  }

  try {
    // Create HTTPS server with TLS options and Express app
    const server = https.createServer({
      key: httpsOptions.key,
      cert: httpsOptions.cert,
      minVersion: httpsOptions.minVersion
    }, app);

    console.log('[HTTPS Config] Secure server created successfully');
    console.log(`[HTTPS Config] TLS minimum version: ${httpsOptions.minVersion}`);

    return server;
  } catch (error) {
    // Handle server creation errors
    console.error('[HTTPS Config] Failed to create secure server:');
    console.error(`  ${error.message}`);
    
    if (error.code === 'ERR_SSL_EE_KEY_TOO_SMALL') {
      console.error('[HTTPS Config] SSL key is too small. Use at least 2048-bit RSA key.');
    } else if (error.message.includes('key values mismatch')) {
      console.error('[HTTPS Config] SSL key and certificate do not match.');
    }
    
    return null;
  }
}

// =============================================================================
// MODULE EXPORTS
// =============================================================================

/**
 * Module exports for HTTPS/TLS configuration
 * 
 * @exports httpsOptions - TLS configuration object with key, cert, and minVersion
 * @exports createSecureServer - Function to create HTTPS server with Express app
 * @exports loadCertificates - Function to load SSL certificates from disk
 */
module.exports = {
  /**
   * HTTPS server options for TLS configuration
   * Contains key, cert, and minVersion properties
   * @type {Object}
   */
  httpsOptions,

  /**
   * Create an HTTPS server with Express application
   * @type {Function}
   */
  createSecureServer,

  /**
   * Load SSL certificates from configured paths
   * @type {Function}
   */
  loadCertificates
};
