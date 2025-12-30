# Security Documentation

This document provides a comprehensive guide to the security controls implemented in this application. It covers all security middleware configurations, best practices, and deployment requirements for maintaining a secure Node.js application.

## Table of Contents

1. [Overview](#overview)
2. [Security Headers](#security-headers)
3. [Rate Limiting](#rate-limiting)
4. [CORS Configuration](#cors-configuration)
5. [Input Validation](#input-validation)
6. [HTTPS Configuration](#https-configuration)
7. [Environment Variables](#environment-variables)
8. [Deployment Checklist](#deployment-checklist)
9. [Security Testing](#security-testing)
10. [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)

---

## Overview

### Security Controls Implemented

This application implements multiple layers of security controls to protect against common web vulnerabilities:

| Security Control | Package | Version | Purpose |
|-----------------|---------|---------|---------|
| Security Headers | helmet | ^8.1.0 | Sets 15+ HTTP security headers |
| CORS Policies | cors | ^2.8.5 | Controls cross-origin resource sharing |
| Rate Limiting | express-rate-limit | ^8.2.1 | Prevents abuse and brute-force attacks |
| Input Validation | express-validator | ^7.3.1 | Validates and sanitizes user input |
| HTTPS Support | Node.js https | Built-in | Encrypts data in transit |

### OWASP Top 10 2021 Mitigations

The implemented security controls address the following OWASP Top 10 2021 vulnerabilities:

| OWASP ID | Vulnerability | Mitigation |
|----------|--------------|------------|
| A01:2021 | Broken Access Control | CORS whitelist policies restrict unauthorized cross-origin access |
| A03:2021 | Injection | Input validation via express-validator prevents injection attacks |
| A05:2021 | Security Misconfiguration | Helmet.js security headers protect against browser-based attacks |
| A07:2021 | Identification and Authentication Failures | Rate limiting prevents brute-force attacks |

### Quick Start Commands

```bash
# Install dependencies
npm install

# Generate development SSL certificates
mkdir -p certs
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.cert \
  -days 365 -nodes \
  -subj "/CN=localhost"

# Start server (HTTP mode)
npm start

# Start server (HTTPS mode)
npm run start:secure

# Run security audit
npm audit --production

# Verify security headers
curl -I http://localhost:3000/
curl -I -k https://localhost:3443/
```

### Middleware Execution Order

Security middleware is applied in the following order (critical for proper security enforcement):

```
1. helmet()          → Sets security headers on all responses
2. cors()            → Handles CORS preflight and headers
3. rateLimit()       → Throttles requests before processing
4. express.json()    → Parses request body for validation
5. validation        → Validates parsed input data
6. route handlers    → Business logic execution
7. errorHandler      → Handles errors securely
```

---

## Security Headers

### Helmet.js Configuration

The application uses [Helmet.js](https://helmetjs.github.io/) to set comprehensive HTTP security headers. Helmet is a collection of 15 smaller middleware functions that set HTTP response headers.

### Security Headers Reference

| Header | Default Value | Security Purpose |
|--------|--------------|------------------|
| `Content-Security-Policy` | `default-src 'self'; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' https: 'unsafe-inline'; upgrade-insecure-requests` | Prevents XSS attacks by controlling which resources can be loaded |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context to prevent cross-origin attacks |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevents resources from being loaded by cross-origin requests |
| `Origin-Agent-Cluster` | `?1` | Requests origin-keyed agent clustering for isolation |
| `Referrer-Policy` | `no-referrer` | Controls how much referrer information is shared |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | Enforces HTTPS connections (HSTS) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing attacks |
| `X-DNS-Prefetch-Control` | `off` | Disables DNS prefetching to prevent information leakage |
| `X-Download-Options` | `noopen` | Prevents IE from executing downloads in site context |
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking attacks via iframe embedding |
| `X-Permitted-Cross-Domain-Policies` | `none` | Restricts Adobe Flash/Acrobat cross-domain policies |
| `X-XSS-Protection` | `0` | Disables buggy browser XSS filter (CSP is preferred) |

### Content Security Policy Details

The Content-Security-Policy (CSP) header is particularly important for preventing XSS attacks:

```
default-src 'self'           → Default fallback for all resource types
base-uri 'self'              → Restricts base URL to same origin
font-src 'self' https: data: → Allows fonts from same origin, HTTPS, or data URIs
form-action 'self'           → Restricts form submissions to same origin
frame-ancestors 'self'       → Only same-origin can embed this page
img-src 'self' data:         → Allows images from same origin or data URIs
object-src 'none'            → Blocks all plugin content (Flash, Java, etc.)
script-src 'self'            → Only allows scripts from same origin
script-src-attr 'none'       → Blocks inline event handlers
style-src 'self' https: 'unsafe-inline' → Allows styles from same origin and inline
upgrade-insecure-requests    → Upgrades HTTP requests to HTTPS
```

### Customizing Security Headers

To customize helmet configuration, modify `config/security.js`:

```javascript
// Example: Relaxing CSP for specific use cases
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://trusted-cdn.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  // Disable specific headers if needed (not recommended)
  // crossOriginEmbedderPolicy: false,
};
```

### Verifying Security Headers

```bash
# Check all response headers
curl -I http://localhost:3000/

# Expected output includes:
# Content-Security-Policy: default-src 'self'...
# Cross-Origin-Opener-Policy: same-origin
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# Strict-Transport-Security: max-age=15552000; includeSubDomains
```

---

## Rate Limiting

### Default Configuration

The application uses [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) to protect against brute-force attacks and abuse.

| Setting | Default Value | Description |
|---------|--------------|-------------|
| `windowMs` | 900000 (15 minutes) | Time window for rate limiting |
| `limit` | 100 | Maximum requests per window per IP |
| `standardHeaders` | `draft-8` | Uses latest RateLimit header draft |
| `legacyHeaders` | `false` | Disables deprecated X-RateLimit headers |
| `message` | Custom JSON | Error response when limit exceeded |

### Rate Limit Response Headers

When rate limiting is active, the following headers are included in responses:

| Header | Description | Example Value |
|--------|-------------|---------------|
| `RateLimit-Limit` | Maximum requests allowed | `100` |
| `RateLimit-Remaining` | Requests remaining in window | `99` |
| `RateLimit-Reset` | Seconds until window resets | `900` |
| `Retry-After` | Seconds to wait (when limited) | `900` |

### Rate Limit Exceeded Response

When a client exceeds the rate limit, they receive:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 900
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 900

{
  "error": "Too Many Requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 900
}
```

### Customizing Rate Limits

Adjust rate limits via environment variables:

```bash
# Increase limit for high-traffic APIs
RATE_LIMIT_WINDOW_MS=60000    # 1 minute window
RATE_LIMIT_MAX=1000           # 1000 requests per minute

# Stricter limits for sensitive endpoints
RATE_LIMIT_WINDOW_MS=3600000  # 1 hour window
RATE_LIMIT_MAX=10             # 10 requests per hour
```

Or modify `config/security.js` directly:

```javascript
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 100,                 // 100 requests per window
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: 900,
  },
  // Skip rate limiting for specific IPs (use with caution)
  skip: (req) => {
    const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
    return trustedIPs.includes(req.ip);
  },
};
```

### Testing Rate Limits

```bash
# Send 101 requests rapidly to trigger rate limiting
for i in {1..101}; do 
  echo "Request $i: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
done

# Expected: First 100 return 200, 101st returns 429
```

---

## CORS Configuration

### Default Configuration

The application uses [cors](https://www.npmjs.com/package/cors) middleware with a whitelist-based origin configuration for secure cross-origin resource sharing.

| Setting | Default Value | Description |
|---------|--------------|-------------|
| `origin` | Whitelist function | Only allows explicitly configured origins |
| `methods` | `GET, POST, PUT, DELETE, PATCH, OPTIONS` | Allowed HTTP methods |
| `allowedHeaders` | `Content-Type, Authorization, X-Requested-With` | Allowed request headers |
| `credentials` | `true` | Allows cookies and auth headers |
| `optionsSuccessStatus` | `200` | Status for preflight (legacy browser support) |
| `maxAge` | `86400` | Preflight cache duration (24 hours) |

### Configuring Allowed Origins

Set allowed origins via the `CORS_ORIGINS` environment variable:

```bash
# Single origin
CORS_ORIGINS=https://example.com

# Multiple origins (comma-separated)
CORS_ORIGINS=https://example.com,https://app.example.com,https://admin.example.com

# Development (localhost)
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

### CORS Response Headers

When a valid cross-origin request is made:

```http
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

### CORS Error Response

When an origin is not whitelisted:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "CORS Error",
  "message": "Origin not allowed by CORS policy"
}
```

### Testing CORS Configuration

```bash
# Test allowed origin
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     -I http://localhost:3000/

# Test blocked origin
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     -I http://localhost:3000/
```

### Customizing CORS Configuration

Modify `config/security.js` for advanced CORS settings:

```javascript
const corsConfig = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400,
};
```

---

## Input Validation

### Overview

The application uses [express-validator](https://express-validator.github.io/) to validate and sanitize all incoming request data. This prevents injection attacks and ensures data integrity.

### Validation Middleware Usage

```javascript
const { body, query, param, validationResult } = require('express-validator');

// Example: Validating a POST request body
app.post('/api/users',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .escape()
      .withMessage('Name must be 2-100 characters'),
    body('age')
      .optional()
      .isInt({ min: 0, max: 150 })
      .toInt()
      .withMessage('Age must be a valid number'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array(),
      });
    }
    // Process validated data
  }
);
```

### Common Validation Rules

| Validator | Purpose | Example |
|-----------|---------|---------|
| `isEmail()` | Validates email format | `body('email').isEmail()` |
| `isLength()` | Validates string length | `body('name').isLength({ min: 2, max: 50 })` |
| `isInt()` | Validates integer | `body('age').isInt({ min: 0 })` |
| `isUUID()` | Validates UUID format | `param('id').isUUID()` |
| `isURL()` | Validates URL format | `body('website').isURL()` |
| `isAlphanumeric()` | Only letters and numbers | `body('username').isAlphanumeric()` |
| `matches()` | Regex pattern match | `body('phone').matches(/^\+?[\d\s-]+$/)` |

### Sanitization Methods

| Sanitizer | Purpose | Example |
|-----------|---------|---------|
| `trim()` | Remove whitespace | `body('name').trim()` |
| `escape()` | Escape HTML characters | `body('comment').escape()` |
| `normalizeEmail()` | Standardize email | `body('email').normalizeEmail()` |
| `toInt()` | Convert to integer | `body('age').toInt()` |
| `toBoolean()` | Convert to boolean | `body('active').toBoolean()` |
| `blacklist()` | Remove characters | `body('text').blacklist('<>')` |

### Validation Error Response Format

When validation fails, the API returns:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Validation Error",
  "message": "Request validation failed",
  "details": [
    {
      "type": "field",
      "value": "invalid-email",
      "msg": "Valid email is required",
      "path": "email",
      "location": "body"
    },
    {
      "type": "field",
      "value": "",
      "msg": "Name must be 2-100 characters",
      "path": "name",
      "location": "body"
    }
  ]
}
```

### Custom Validation Schemas

Create reusable validation schemas in `middleware/validation.js`:

```javascript
const validationSchemas = {
  createUser: [
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
  ],
  
  updateUser: [
    param('id').isUUID(),
    body('email').optional().isEmail().normalizeEmail(),
    body('name').optional().trim().isLength({ min: 2, max: 100 }).escape(),
  ],
  
  queryUsers: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim().escape(),
  ],
};
```

---

## HTTPS Configuration

### Overview

HTTPS support enables encrypted communication between clients and the server using TLS (Transport Layer Security). This protects data in transit from eavesdropping and tampering.

### TLS Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| TLS Version | 1.2 | 1.3 |
| Key Size (RSA) | 2048 bits | 4096 bits |
| Key Size (ECDSA) | 256 bits | 384 bits |
| Certificate Validity | N/A | 90-365 days |

### Certificate Setup

#### Development Certificates (Self-Signed)

For local development, generate self-signed certificates:

```bash
# Create certificates directory
mkdir -p certs

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.cert \
  -days 365 -nodes \
  -subj "/CN=localhost"

# Set appropriate permissions
chmod 600 certs/server.key
chmod 644 certs/server.cert
```

See `certs/README.md` for detailed certificate generation instructions.

#### Production Certificates

For production, obtain certificates from a trusted Certificate Authority (CA):

1. **Let's Encrypt** (Free, automated):
   ```bash
   certbot certonly --standalone -d yourdomain.com
   ```

2. **Commercial CA** (DigiCert, Comodo, etc.):
   - Generate CSR: `openssl req -new -key server.key -out server.csr`
   - Submit CSR to CA
   - Install received certificate

### HTTP to HTTPS Redirect

The server automatically redirects HTTP requests to HTTPS in production:

```javascript
// All HTTP requests redirect to HTTPS
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
```

### HTTPS Configuration Options

Configure HTTPS via environment variables:

```bash
# HTTPS port (default: 3443)
HTTPS_PORT=443

# Certificate file paths
SSL_KEY_PATH=./certs/server.key
SSL_CERT_PATH=./certs/server.cert

# Optional: Certificate chain
SSL_CA_PATH=./certs/ca-bundle.crt

# Enable/disable HTTPS
HTTPS_ENABLED=true
```

### Verifying HTTPS Configuration

```bash
# Test HTTPS connection
curl -k -v https://localhost:3443/

# Check TLS version and cipher
openssl s_client -connect localhost:3443 -tls1_2

# Verify certificate details
openssl s_client -connect localhost:3443 </dev/null 2>/dev/null | \
  openssl x509 -noout -text
```

### HSTS (HTTP Strict Transport Security)

The server sets HSTS headers via Helmet.js to enforce HTTPS:

```
Strict-Transport-Security: max-age=15552000; includeSubDomains
```

This tells browsers to:
- Only connect via HTTPS for 180 days
- Apply to all subdomains
- Prevent users from bypassing certificate warnings

---

## Environment Variables

### Complete Environment Variable Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | `development` | No | Environment mode (`development`, `production`, `test`) |
| `HTTP_PORT` | `3000` | No | HTTP server port |
| `HTTPS_PORT` | `3443` | No | HTTPS server port |
| `HTTPS_ENABLED` | `false` | No | Enable HTTPS server |
| `SSL_KEY_PATH` | `./certs/server.key` | If HTTPS | Path to SSL private key |
| `SSL_CERT_PATH` | `./certs/server.cert` | If HTTPS | Path to SSL certificate |
| `SSL_CA_PATH` | (none) | No | Path to CA certificate chain |
| `RATE_LIMIT_WINDOW_MS` | `900000` | No | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX` | `100` | No | Maximum requests per window |
| `CORS_ORIGINS` | `http://localhost:3000` | No | Comma-separated allowed origins |
| `TRUSTED_IPS` | (none) | No | Comma-separated IPs to skip rate limiting |

### Environment File Template

Create a `.env` file based on `.env.example`:

```bash
# Server Configuration
NODE_ENV=development
HTTP_PORT=3000
HTTPS_PORT=3443

# HTTPS Configuration
HTTPS_ENABLED=false
SSL_KEY_PATH=./certs/server.key
SSL_CERT_PATH=./certs/server.cert

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Trusted IPs (skip rate limiting)
# TRUSTED_IPS=127.0.0.1,10.0.0.1
```

### Environment-Specific Configurations

#### Development
```bash
NODE_ENV=development
HTTPS_ENABLED=false
RATE_LIMIT_MAX=1000
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
```

#### Staging
```bash
NODE_ENV=staging
HTTPS_ENABLED=true
RATE_LIMIT_MAX=500
CORS_ORIGINS=https://staging.example.com
```

#### Production
```bash
NODE_ENV=production
HTTPS_ENABLED=true
HTTPS_PORT=443
RATE_LIMIT_MAX=100
CORS_ORIGINS=https://example.com,https://app.example.com
```

---

## Deployment Checklist

### Pre-Deployment Security Checklist

Use this checklist before deploying to production:

#### SSL/TLS Certificates
- [ ] Obtain valid SSL certificates from a trusted CA
- [ ] Verify certificate chain is complete
- [ ] Ensure private key file has restricted permissions (600)
- [ ] Configure automatic certificate renewal (if using Let's Encrypt)
- [ ] Test certificate validity: `openssl verify -CAfile ca-bundle.crt server.cert`

#### CORS Configuration
- [ ] Replace development origins with production domains
- [ ] Remove `localhost` from allowed origins
- [ ] Verify all legitimate origins are whitelisted
- [ ] Test CORS from all client applications

#### Rate Limiting
- [ ] Adjust rate limits based on expected traffic
- [ ] Configure different limits for different endpoints if needed
- [ ] Set up monitoring for rate limit events
- [ ] Test rate limiting under load

#### Security Headers
- [ ] Verify all Helmet headers are present in responses
- [ ] Customize CSP for your specific needs
- [ ] Test with security header scanners (securityheaders.com)
- [ ] Review and adjust HSTS max-age for production

#### Input Validation
- [ ] Ensure all endpoints have validation middleware
- [ ] Test validation with malformed inputs
- [ ] Verify error messages don't leak sensitive information
- [ ] Test for injection vulnerabilities

#### Environment Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Remove all development-only configurations
- [ ] Secure all environment variables
- [ ] Verify no secrets are in source code

#### HTTPS Enforcement
- [ ] Enable HTTPS redirect in production
- [ ] Verify HTTP to HTTPS redirect works
- [ ] Test all endpoints over HTTPS
- [ ] Verify HSTS header is set correctly

#### Dependency Security
- [ ] Run `npm audit --production` and fix vulnerabilities
- [ ] Update all dependencies to latest secure versions
- [ ] Remove unused dependencies
- [ ] Lock dependency versions with `package-lock.json`

### Production Security Commands

```bash
# Security audit
npm audit --production

# Check for outdated packages
npm outdated

# Update packages
npm update

# Test security headers
curl -I https://your-domain.com/

# Test rate limiting
ab -n 150 -c 10 https://your-domain.com/

# Verify TLS configuration
nmap --script ssl-enum-ciphers -p 443 your-domain.com
```

---

## Security Testing

### Automated Security Testing

#### npm Audit
```bash
# Check for known vulnerabilities
npm audit

# Check production dependencies only
npm audit --production

# Generate JSON report
npm audit --json > audit-report.json
```

#### Security Header Testing
```bash
# Check all security headers
curl -I https://localhost:3443/ | grep -E "(Content-Security|X-Frame|X-Content|Strict-Transport)"
```

### Manual Security Testing

#### Test Rate Limiting
```bash
# Rapid requests to trigger rate limit
for i in {1..110}; do 
  response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
  echo "Request $i: $response"
  if [ "$response" == "429" ]; then
    echo "Rate limited at request $i"
    break
  fi
done
```

#### Test CORS
```bash
# Test allowed origin
curl -H "Origin: https://allowed-domain.com" -I http://localhost:3000/

# Test blocked origin  
curl -H "Origin: https://malicious-site.com" -I http://localhost:3000/
```

#### Test Input Validation
```bash
# Send invalid JSON
curl -X POST -H "Content-Type: application/json" \
  -d '{"email": "invalid", "name": ""}' \
  http://localhost:3000/api/validate

# Expected: 400 Bad Request with validation errors
```

### Third-Party Security Scanners

- **Mozilla Observatory**: https://observatory.mozilla.org/
- **Security Headers**: https://securityheaders.com/
- **SSL Labs**: https://www.ssllabs.com/ssltest/

---

## Reporting Security Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability in this application, please follow responsible disclosure practices:

1. **Do not** disclose the vulnerability publicly until it has been addressed
2. **Do not** exploit the vulnerability beyond what is necessary to demonstrate it
3. **Report** the vulnerability promptly using the contact methods below

### How to Report

Please report security vulnerabilities by:

1. **Email**: security@example.com (replace with actual contact)
2. **Issue Tracker**: Create a private security advisory on GitHub

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information for follow-up

### Response Timeline

- **Acknowledgment**: Within 24 hours
- **Initial Assessment**: Within 72 hours
- **Fix Timeline**: Based on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

---

## Additional Resources

### Security References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)

### Security Tools

- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Snyk](https://snyk.io/)
- [OWASP ZAP](https://www.zaproxy.org/)
- [Burp Suite](https://portswigger.net/burp)

---

*Last Updated: December 2024*

*This document should be reviewed and updated whenever security configurations change.*
