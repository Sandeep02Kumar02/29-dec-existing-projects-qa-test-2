# SSL/TLS Certificates Directory

This directory is used to store SSL/TLS certificates for HTTPS support.

## Directory Contents

- `server.key` - Private key file (not committed to version control)
- `server.cert` - Certificate file (not committed to version control)

## Generating Self-Signed Certificates (Development)

For development and testing, you can generate self-signed certificates using OpenSSL:

```bash
# Generate a self-signed certificate valid for 365 days
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.cert \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

### Command Breakdown

- `req -x509`: Generate a self-signed certificate
- `-newkey rsa:4096`: Create a new 4096-bit RSA key
- `-keyout certs/server.key`: Output path for the private key
- `-out certs/server.cert`: Output path for the certificate
- `-days 365`: Certificate validity period
- `-nodes`: Don't encrypt the private key with a passphrase
- `-subj "/CN=localhost"`: Certificate subject (Common Name = localhost)

## Production Certificates

For production deployments, you should use certificates from a trusted Certificate Authority (CA):

### Option 1: Let's Encrypt (Free)

1. Install Certbot: `apt-get install certbot`
2. Generate certificate: `certbot certonly --standalone -d your-domain.com`
3. Certificates will be stored in `/etc/letsencrypt/live/your-domain.com/`

### Option 2: Commercial CA

Purchase a certificate from a trusted CA like:
- DigiCert
- Comodo
- GlobalSign
- GoDaddy

### Certificate Renewal

- Let's Encrypt certificates expire after 90 days
- Set up automatic renewal: `certbot renew --quiet`
- Add to crontab: `0 0 1 * * certbot renew --quiet`

## Environment Variables

Configure certificate paths via environment variables:

```bash
# Default paths
SSL_KEY_PATH=./certs/server.key
SSL_CERT_PATH=./certs/server.cert

# Enable/disable HTTPS
HTTPS_ENABLED=true
HTTPS_PORT=3443
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit private keys** to version control
2. Keep private key file permissions restricted: `chmod 600 certs/server.key`
3. Use strong key sizes (2048-bit minimum, 4096-bit recommended)
4. Rotate certificates before they expire
5. Use only TLS 1.2 or higher (configured in `config/https.js`)

## Troubleshooting

### Certificate Not Trusted

Self-signed certificates will show a security warning in browsers. This is expected for development.

### Permission Denied

```bash
# Fix permissions
chmod 600 certs/server.key
chmod 644 certs/server.cert
```

### Wrong Certificate Path

Check environment variables:
```bash
echo $SSL_KEY_PATH
echo $SSL_CERT_PATH
```

## Verifying Certificates

```bash
# View certificate details
openssl x509 -in certs/server.cert -text -noout

# Test HTTPS connection
curl -k https://localhost:3443

# Check TLS version
openssl s_client -connect localhost:3443 -tls1_2
```
