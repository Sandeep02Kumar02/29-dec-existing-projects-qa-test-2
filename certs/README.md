# SSL Certificates

This directory stores SSL/TLS certificates for HTTPS server configuration. The certificates enable encrypted communication between clients and the server, protecting data in transit from eavesdropping and tampering.

## File Locations

The following certificate files are expected in this directory:

| File | Description |
|------|-------------|
| `server.key` | SSL private key file - Contains the cryptographic private key used for TLS handshake |
| `server.cert` | SSL certificate file - Contains the public certificate presented to clients |

These paths are configured in `config/https.js` and can be overridden using environment variables. The HTTPS server on port 3443 loads these certificates at startup.

## Development Certificates

For local development and testing, you can generate self-signed certificates using OpenSSL.

### Generate Self-Signed Certificate

Run the following command from the project root directory:

```bash
# Generate self-signed certificate for development
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.cert \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

### Command Explanation

| Option | Description |
|--------|-------------|
| `req -x509` | Generate a self-signed X.509 certificate |
| `-newkey rsa:4096` | Create a new 4096-bit RSA private key |
| `-keyout certs/server.key` | Output path for the private key file |
| `-out certs/server.cert` | Output path for the certificate file |
| `-days 365` | Certificate validity period (1 year) |
| `-nodes` | Do not encrypt the private key with a passphrase |
| `-subj "/CN=localhost"` | Set the certificate Common Name to localhost |

### Important Notes for Development

- **Browser Warnings**: Self-signed certificates will trigger security warnings in browsers. This is expected behavior for development environments.
- **Validity Period**: The certificate is valid for 365 days. Regenerate before expiration.
- **Local Use Only**: Self-signed certificates should only be used for local development, never in production.

## Production Certificates

For production deployments, you must obtain certificates from a trusted Certificate Authority (CA).

### Option 1: Let's Encrypt (Free, Automated)

[Let's Encrypt](https://letsencrypt.org/) provides free, automated TLS certificates.

```bash
# Install Certbot
apt-get update && apt-get install -y certbot

# Generate certificate (standalone mode)
certbot certonly --standalone -d yourdomain.com

# Certificate files will be located at:
# /etc/letsencrypt/live/yourdomain.com/privkey.pem   -> Use as SSL_KEY_PATH
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem -> Use as SSL_CERT_PATH
```

**Let's Encrypt Renewal**:
- Certificates expire after 90 days
- Set up automatic renewal: `certbot renew --quiet`
- Add to crontab: `0 0 * * * certbot renew --quiet`

### Option 2: Commercial Certificate Authorities

For enhanced validation (OV/EV certificates) or specific compliance requirements, consider commercial CAs:

- **DigiCert** - Enterprise-grade certificates with extended validation
- **Comodo/Sectigo** - Wide range of certificate types
- **GlobalSign** - Trusted enterprise certificates
- **GoDaddy** - Affordable domain-validated certificates

**General Steps for Commercial CAs**:
1. Generate a Certificate Signing Request (CSR)
2. Submit CSR to the CA
3. Complete domain/organization validation
4. Download and install the certificate and certificate chain

### Certificate Chain Requirements

For production HTTPS, ensure you have the complete certificate chain:
- **Server Certificate** - Your domain's certificate
- **Intermediate Certificates** - CA's intermediate certificates
- **Root Certificate** - Usually trusted by browsers/OS

Concatenate certificates in order for proper chain:
```bash
cat your_domain.crt intermediate.crt > server.cert
```

## Security Notes

⚠️ **CRITICAL SECURITY REQUIREMENTS**

### Never Commit Private Keys to Version Control

The following patterns should be in your `.gitignore`:

```gitignore
# SSL/TLS Certificate Files - NEVER COMMIT
*.key
*.cert
*.pem
*.crt
*.p12
*.pfx
certs/server.key
certs/server.cert
```

### Secure Key Storage Practices

1. **File Permissions**: Restrict access to private key files
   ```bash
   chmod 600 certs/server.key
   chmod 644 certs/server.cert
   ```

2. **Ownership**: Ensure only the application user can read the key
   ```bash
   chown $USER:$USER certs/server.key
   ```

3. **Secret Management**: In production, consider using:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Cloud Secret Manager

4. **Key Rotation**: Regularly rotate certificates before expiration

### TLS Version Requirements

This application requires **TLS 1.2 or higher** (configured in `config/https.js`). Older protocols (TLS 1.0, TLS 1.1, SSLv3) are disabled due to known security vulnerabilities.

To verify TLS version:
```bash
# Test TLS 1.2 connection
openssl s_client -connect localhost:3443 -tls1_2

# Test TLS 1.3 connection (if supported)
openssl s_client -connect localhost:3443 -tls1_3
```

## Environment Variables

Configure SSL certificate paths using environment variables in your `.env` file or system environment:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `SSL_KEY_PATH` | `./certs/server.key` | Path to the SSL private key file |
| `SSL_CERT_PATH` | `./certs/server.cert` | Path to the SSL certificate file |
| `HTTPS_ENABLED` | `true` | Enable/disable HTTPS server |
| `HTTPS_PORT` | `3443` | Port for HTTPS server |

### Example .env Configuration

```bash
# Development (self-signed certificates)
SSL_KEY_PATH=./certs/server.key
SSL_CERT_PATH=./certs/server.cert
HTTPS_PORT=3443

# Production (Let's Encrypt)
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
HTTPS_PORT=443
```

## Verification Commands

### View Certificate Details

```bash
# Display certificate information
openssl x509 -in certs/server.cert -text -noout

# Check certificate expiration date
openssl x509 -in certs/server.cert -enddate -noout
```

### Test HTTPS Connection

```bash
# Test connection (skip certificate verification for self-signed)
curl -k https://localhost:3443

# Test with certificate verification (requires valid cert)
curl --cacert certs/server.cert https://localhost:3443
```

### Verify Certificate and Key Match

```bash
# These commands should output the same modulus hash
openssl x509 -noout -modulus -in certs/server.cert | openssl md5
openssl rsa -noout -modulus -in certs/server.key | openssl md5
```

## Troubleshooting

### Error: Certificate Not Trusted

**Cause**: Self-signed certificates are not trusted by browsers by default.

**Solution**: 
- For development, accept the browser warning and proceed
- For production, use certificates from a trusted CA

### Error: Permission Denied

**Cause**: Insufficient permissions to read certificate files.

**Solution**:
```bash
chmod 600 certs/server.key
chmod 644 certs/server.cert
```

### Error: Unable to Load Certificate

**Cause**: Incorrect file paths or missing files.

**Solution**:
```bash
# Verify files exist
ls -la certs/

# Check environment variables
echo $SSL_KEY_PATH
echo $SSL_CERT_PATH
```

### Error: Key and Certificate Mismatch

**Cause**: The private key does not match the certificate.

**Solution**: Regenerate both files together using the OpenSSL command above.
