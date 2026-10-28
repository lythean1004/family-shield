#!/usr/bin/env bash
# Run on the VM as fsops: issue Let's Encrypt cert (webroot) and install the familyshield.kr Nginx config.
# Usage: ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/03-nginx-https.sh'
set -euo pipefail

DOMAIN=familyshield.kr
REPO=/srv/family-shield/repo
ACME=/srv/family-shield/acme
CONF=/etc/nginx/conf.d/$DOMAIN.conf

mkdir -p "$ACME"
chmod 755 /srv/family-shield "$ACME"

if ! sudo ls "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" >/dev/null 2>&1; then
  # Step 1: HTTP-only server so the ACME challenge can be answered
  sudo tee "$CONF" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    location ^~ /.well-known/acme-challenge/ { root $ACME; }
    location / { return 404; }
}
EOF
  sudo nginx -t
  sudo systemctl reload nginx
  sudo certbot certonly --webroot -w "$ACME" -d "$DOMAIN" -d "www.$DOMAIN" \
    --agree-tos --register-unsafely-without-email --non-interactive \
    --deploy-hook "systemctl reload nginx"
else
  echo "certificate: already present"
fi

# Step 2: full config (HTTPS, proxy, static files, headers)
sudo install -m 644 "$REPO/deploy/nginx/$DOMAIN.conf" "$CONF"
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable --now certbot-renew.timer >/dev/null 2>&1 || true
echo "renew timer: $(systemctl is-active certbot-renew.timer)"
sudo certbot certificates 2>/dev/null | grep -E 'Domains|Expiry' || true
