#!/bin/bash
# Generate self-signed certificates for Asterisk SIP-TLS

set -e

CERT_DIR="asterisk-conf/keys"
VM_IP="${VM_IP:-34.142.150.253}"  # Default to your GCP VM IP, override with env var

echo "Generating self-signed certificates for Asterisk..."
echo "Using IP/CN: $VM_IP"

mkdir -p "$CERT_DIR"

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout "$CERT_DIR/asterisk.key" \
  -out "$CERT_DIR/asterisk.pem" \
  -days 365 \
  -nodes \
  -subj "/CN=$VM_IP"

# Set proper permissions
chmod 600 "$CERT_DIR/asterisk.key"
chmod 644 "$CERT_DIR/asterisk.pem"

echo "✅ Certificates generated successfully!"
echo "   Key: $CERT_DIR/asterisk.key"
echo "   Cert: $CERT_DIR/asterisk.pem"
echo ""
echo "Note: For production, use CA-signed certificates."
