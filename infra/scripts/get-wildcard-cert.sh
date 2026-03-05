#!/bin/bash
# =============================================================================
# Get Let's Encrypt wildcard cert for *.dns.shield.rstglobal.in
# Requires manual DNS TXT record creation in GoDaddy DNS panel
# =============================================================================
#
# DNS provider: GoDaddy (ns73.domaincontrol.com, ns74.domaincontrol.com)
#
# STEPS:
# 1. Run this script
# 2. Certbot will display a TXT record value to add
# 3. Go to GoDaddy DNS management for rstglobal.in
# 4. Add TXT record: _acme-challenge.dns.shield  with the displayed value
# 5. Wait 2-3 minutes for DNS propagation
# 6. Press Enter in the terminal to continue
# 7. Certbot will verify and issue the cert
#
# After success, update nginx to use the Let's Encrypt cert:
#   ssl_certificate     /etc/letsencrypt/live/dns.shield.rstglobal.in/fullchain.pem;
#   ssl_certificate_key /etc/letsencrypt/live/dns.shield.rstglobal.in/privkey.pem;
# =============================================================================

set -e

echo "Starting wildcard cert request for *.dns.shield.rstglobal.in"
echo "You will need to create a DNS TXT record in GoDaddy."
echo ""

certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "*.dns.shield.rstglobal.in" \
  -d "dns.shield.rstglobal.in" \
  --agree-tos \
  --email admin@rstglobal.in

echo ""
echo "SUCCESS! Wildcard cert issued."
echo "Cert: /etc/letsencrypt/live/dns.shield.rstglobal.in/fullchain.pem"
echo "Key:  /etc/letsencrypt/live/dns.shield.rstglobal.in/privkey.pem"
echo ""
echo "Update nginx config to use these paths and reload: systemctl reload nginx"
