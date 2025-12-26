# Gate1 System - Complete Production Setup Guide

## 📋 Pre-Flight Checklist

Before starting, ensure you have:
- [ ] Domain `gate1.cloud` registered and DNS access
- [ ] VPS with Ubuntu 22.04 (Contabo or similar)
- [ ] SSH access to VPS
- [ ] GitHub account

---

# PHASE 1: LOCAL PREPARATION (Your Computer)

## Step 1.1: Generate Required Keys

Open terminal in the `backend` folder and run:

```bash
cd c:\Users\DenisMakokha\CascadeProjects\Gate1System\backend

# Generate APP_KEY (copy this value)
php artisan key:generate --show

# Generate JWT_SECRET (copy this value)  
php artisan jwt:secret --show
```

**Save these values - you'll need them for GitHub Secrets!**

If you don't have PHP locally, generate random keys:
```bash
# APP_KEY (base64 encoded 32 bytes)
openssl rand -base64 32

# JWT_SECRET (64 character hex string)
openssl rand -hex 32

# DB_PASSWORD (strong random password)
openssl rand -base64 24
```

## Step 1.2: Generate SSH Key for Deployment

```bash
# Generate SSH key pair for deployment
ssh-keygen -t ed25519 -C "gate1-deploy" -f ~/.ssh/gate1_deploy -N ""

# View the private key (you'll add this to GitHub Secrets)
cat ~/.ssh/gate1_deploy

# View the public key (you'll add this to the server)
cat ~/.ssh/gate1_deploy.pub
```

---

# PHASE 2: GITHUB SETUP

## Step 2.1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `Gate1System`
3. Make it **Private**
4. Click **Create repository**

## Step 2.2: Push Code to GitHub

```bash
cd c:\Users\DenisMakokha\CascadeProjects\Gate1System

# Initialize git if not already
git init

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/Gate1System.git

# Add all files
git add .

# Commit
git commit -m "Initial commit: Gate1 System with Docker deployment"

# Push to main branch
git branch -M main
git push -u origin main
```

## Step 2.3: Add GitHub Secrets

Go to: **GitHub → Your Repo → Settings → Secrets and variables → Actions**

Click **New repository secret** for each:

| Secret Name | Value |
|-------------|-------|
| `SSH_HOST` | `157.173.112.150` |
| `SSH_USER` | `nelium` |
| `SSH_KEY` | (paste entire content of `~/.ssh/gate1_deploy` including BEGIN/END lines) |
| `APP_KEY` | `base64:YOUR_GENERATED_KEY` |
| `DB_PASSWORD` | `YOUR_STRONG_PASSWORD` |
| `JWT_SECRET` | `YOUR_GENERATED_JWT_SECRET` |

## Step 2.4: Create Production Environment

1. Go to: **GitHub → Settings → Environments**
2. Click **New environment**
3. Name: `production`
4. Click **Configure environment**
5. (Optional) Add protection rules

---

# PHASE 3: SERVER SETUP (VPS)

## Step 3.1: SSH into Server

```bash
ssh nelium@157.173.112.150
```

## Step 3.2: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

## Step 3.3: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Log out and back in for group changes
exit
```

SSH back in:
```bash
ssh nelium@157.173.112.150
```

## Step 3.4: Install Other Dependencies

```bash
sudo apt install -y git nginx certbot python3-certbot-nginx ufw fail2ban
```

## Step 3.5: Configure Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
```

## Step 3.6: Add Deployment SSH Key

```bash
# Create .ssh directory if not exists
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key (paste your gate1_deploy.pub content)
echo "YOUR_PUBLIC_KEY_CONTENT_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Step 3.7: Create Application Directory

```bash
sudo mkdir -p /opt/apps/gate1
sudo chown -R $USER:$USER /opt/apps/gate1
```

## Step 3.8: Clone Repository

```bash
cd /opt/apps/gate1
git clone https://github.com/YOUR_USERNAME/Gate1System.git .
```

## Step 3.9: Create Environment File

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in these values:
```env
APP_NAME="Gate 1 System"
APP_ENV=production
APP_KEY=base64:YOUR_APP_KEY_HERE
APP_DEBUG=false
APP_URL=https://api.gate1.cloud

DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=gate1
DB_USERNAME=gate1
DB_PASSWORD=YOUR_DB_PASSWORD_HERE

REDIS_HOST=redis

JWT_SECRET=YOUR_JWT_SECRET_HERE
```

Save: `Ctrl+X`, then `Y`, then `Enter`

---

# PHASE 4: CONFIGURE DNS

## Step 4.1: Add DNS Records

In your domain registrar (Cloudflare, Namecheap, etc.), add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `157.173.112.150` | Auto |
| A | `api` | `157.173.112.150` | Auto |
| A | `www` | `157.173.112.150` | Auto |

Wait 5-15 minutes for DNS propagation.

## Step 4.2: Verify DNS

```bash
# From server
dig gate1.cloud +short
dig api.gate1.cloud +short
```

Both should return `157.173.112.150`

---

# PHASE 5: CONFIGURE NGINX & SSL

## Step 5.1: Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/gate1
```

Paste this configuration:

```nginx
# Gate1 System - Nginx Configuration

upstream gate1_backend {
    server 127.0.0.1:8080;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name gate1.cloud www.gate1.cloud api.gate1.cloud;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# API Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.gate1.cloud;

    # SSL will be configured by certbot
    ssl_certificate /etc/letsencrypt/live/api.gate1.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gate1.cloud/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    client_max_body_size 100M;

    location / {
        proxy_pass http://gate1_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}

# Web Dashboard
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gate1.cloud www.gate1.cloud;

    ssl_certificate /etc/letsencrypt/live/gate1.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gate1.cloud/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    root /opt/apps/gate1/web-dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://gate1_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Save: `Ctrl+X`, then `Y`, then `Enter`

## Step 5.2: Create Certbot Directory

```bash
sudo mkdir -p /var/www/certbot
```

## Step 5.3: Enable Site (temporarily without SSL)

First, create a simple HTTP-only config for certificate generation:

```bash
sudo nano /etc/nginx/sites-available/gate1-temp
```

```nginx
server {
    listen 80;
    server_name gate1.cloud www.gate1.cloud api.gate1.cloud;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'Gate1 Setup in Progress';
        add_header Content-Type text/plain;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/gate1-temp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5.4: Get SSL Certificates

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
    -d gate1.cloud \
    -d www.gate1.cloud \
    -d api.gate1.cloud \
    --email your-email@example.com \
    --agree-tos \
    --non-interactive
```

## Step 5.5: Enable Full Nginx Config

```bash
sudo rm /etc/nginx/sites-enabled/gate1-temp
sudo ln -sf /etc/nginx/sites-available/gate1 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5.6: Auto-Renew SSL

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

# PHASE 6: START APPLICATION

## Step 6.1: Start Docker Containers

```bash
cd /opt/apps/gate1
docker compose up -d
```

## Step 6.2: Wait for Containers to Start

```bash
# Check status
docker compose ps

# Wait for database to be ready (about 30 seconds)
sleep 30
```

## Step 6.3: Run Database Migrations

```bash
docker compose exec app php artisan migrate --force
```

## Step 6.4: Generate Application Keys

```bash
docker compose exec app php artisan key:generate --force
docker compose exec app php artisan jwt:secret --force
```

## Step 6.5: Seed Database (Optional - creates admin user)

```bash
docker compose exec app php artisan db:seed
```

## Step 6.6: Optimize Application

```bash
docker compose exec app php artisan config:cache
docker compose exec app php artisan route:cache
docker compose exec app php artisan view:cache
```

## Step 6.7: Set Permissions

```bash
docker compose exec app chown -R www-data:www-data /var/www/storage
docker compose exec app chmod -R 775 /var/www/storage
```

---

# PHASE 7: BUILD WEB DASHBOARD

## Step 7.1: Install Node.js on Server

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Step 7.2: Build Web Dashboard

```bash
cd /opt/apps/gate1/web-dashboard
npm install
npm run build
```

---

# PHASE 8: VERIFY DEPLOYMENT

## Step 8.1: Test Health Endpoint

```bash
curl https://api.gate1.cloud/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "app": "Gate 1 System",
  "version": "1.0.0",
  "timestamp": "...",
  "services": {
    "database": "connected",
    "cache": "connected"
  }
}
```

## Step 8.2: Test Web Dashboard

Open in browser: https://gate1.cloud

## Step 8.3: Test Login

- **Email**: `admin@gate1.cloud`
- **Password**: `password123`

---

# PHASE 9: FUTURE DEPLOYMENTS (AUTOMATIC)

After initial setup, deployments are automatic:

1. Make changes locally
2. Commit and push to `main` branch
3. GitHub Actions automatically:
   - Builds the application
   - SSHs to server
   - Pulls latest code
   - Runs migrations
   - Rebuilds containers
   - Clears caches

```bash
# Example: Deploy changes
git add .
git commit -m "Your changes"
git push origin main
```

Monitor deployment at: **GitHub → Actions tab**

---

# 🔧 TROUBLESHOOTING

## Check Container Logs
```bash
docker compose logs -f app
docker compose logs -f db
docker compose logs -f redis
```

## Restart Containers
```bash
docker compose restart
```

## Rebuild Containers
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Database Connection Issues
```bash
docker compose exec app php artisan config:clear
docker compose restart db
sleep 10
docker compose exec app php artisan migrate --force
```

## Permission Issues
```bash
docker compose exec app chown -R www-data:www-data /var/www/storage
docker compose exec app chmod -R 775 /var/www/storage
docker compose exec app chmod -R 775 /var/www/bootstrap/cache
```

## View Running Containers
```bash
docker compose ps
```

## Enter Container Shell
```bash
docker compose exec app sh
```

---

# 📞 QUICK REFERENCE

| Service | URL |
|---------|-----|
| **Web Dashboard** | https://gate1.cloud |
| **API** | https://api.gate1.cloud/api |
| **Health Check** | https://api.gate1.cloud/api/health |

| Default Login | Value |
|---------------|-------|
| **Email** | admin@gate1.cloud |
| **Password** | password123 |

| Server | IP |
|--------|-----|
| **VPS** | 157.173.112.150 |
| **SSH** | `ssh nelium@157.173.112.150` |

---

**Powered by Nelium Systems**
**© 2025 Gate1 System**
