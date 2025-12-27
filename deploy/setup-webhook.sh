#!/bin/bash
# Gate1 System - Webhook Server Setup Script
# Run this once on the VPS to set up the webhook server

set -e

APP_DIR="/opt/apps/gate1"
DEPLOY_DIR="$APP_DIR/deploy"

echo "Setting up Gate1 Webhook Server..."

# Make deploy script executable
chmod +x "$DEPLOY_DIR/deploy.sh"

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Generate a webhook secret if not exists
if [ ! -f "$DEPLOY_DIR/.webhook-secret" ]; then
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    echo "$WEBHOOK_SECRET" > "$DEPLOY_DIR/.webhook-secret"
    chmod 600 "$DEPLOY_DIR/.webhook-secret"
    echo "Generated webhook secret: $WEBHOOK_SECRET"
    echo "Add this secret to GitHub webhook settings!"
else
    WEBHOOK_SECRET=$(cat "$DEPLOY_DIR/.webhook-secret")
    echo "Using existing webhook secret: $WEBHOOK_SECRET"
fi

# Stop existing webhook server if running
pm2 delete gate1-webhook 2>/dev/null || true

# Start webhook server with PM2
cd "$DEPLOY_DIR"
WEBHOOK_SECRET="$WEBHOOK_SECRET" pm2 start webhook-server.js --name gate1-webhook

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u $(whoami) --hp $HOME

# Add nginx config for webhook
echo "
# Add this to your nginx config for the webhook endpoint:
# 
# server {
#     listen 80;
#     server_name gate1.cloud www.gate1.cloud api.gate1.cloud;
#     
#     location /webhook {
#         proxy_pass http://127.0.0.1:9001;
#         proxy_http_version 1.1;
#         proxy_set_header Host \$host;
#         proxy_set_header X-Real-IP \$remote_addr;
#     }
#     
#     # ... rest of config
# }
"

echo ""
echo "=========================================="
echo "Webhook Server Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Add the webhook secret to GitHub:"
echo "   Repository → Settings → Webhooks → Add webhook"
echo "   - Payload URL: https://api.gate1.cloud/webhook"
echo "   - Content type: application/json"
echo "   - Secret: $WEBHOOK_SECRET"
echo "   - Events: Just the push event"
echo ""
echo "2. Update nginx config to proxy /webhook to port 9001"
echo ""
echo "3. Test with: curl http://localhost:9001/health"
