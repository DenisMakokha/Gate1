#!/bin/bash
# Gate1 System - Server Initial Setup Script
# Run this ONCE on a fresh Ubuntu 22.04 VPS

set -e

echo "=========================================="
echo "🚀 Gate1 System - Server Setup"
echo "=========================================="

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing dependencies..."
apt install -y \
    curl \
    git \
    unzip \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban \
    htop

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
apt install -y docker-compose-plugin

# Add user to docker group
usermod -aG docker $SUDO_USER || true

# Configure firewall
echo "🔥 Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Configure fail2ban
echo "🔒 Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/apps/gate1
chown -R $SUDO_USER:$SUDO_USER /opt/apps/gate1

# Create nginx configuration for Gate1
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/gate1 << 'NGINX_CONFIG'
# Gate1 System - Nginx Host Configuration
# Reverse proxy to Docker container

upstream gate1_backend {
    server 127.0.0.1:8080;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name gate1.cloud api.gate1.cloud;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.gate1system.com;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/api.gate1system.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gate1system.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Max upload size
    client_max_body_size 100M;

    # Proxy to Laravel container
    location / {
        proxy_pass http://gate1_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        proxy_pass http://gate1_backend;
        expires 1M;
        add_header Cache-Control "public, immutable";
    }
}

# Web Dashboard (if separate domain)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gate1system.com www.gate1system.com;

    ssl_certificate /etc/letsencrypt/live/gate1system.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gate1system.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Serve web dashboard
    root /opt/apps/gate1/web-dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://gate1_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONFIG

# Enable site
ln -sf /etc/nginx/sites-available/gate1 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

echo "=========================================="
echo "✅ Server setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Point your domain DNS to this server IP"
echo "2. Run: certbot --nginx -d api.gate1system.com -d gate1system.com"
echo "3. Clone repo: git clone <repo> /opt/apps/gate1"
echo "4. Create .env file in /opt/apps/gate1/backend/"
echo "5. Run: cd /opt/apps/gate1 && docker compose up -d"
echo ""
