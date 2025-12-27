# Gate1 System - Deployment Guide

> Last updated: December 27, 2025

## 🏗️ Architecture Overview

```
Users (Agents / QA / Admins)
        |
        | HTTPS
        v
Cloudflare (DNS, SSL, WAF, CDN)
        |
        v
Nginx (Host, Reverse Proxy, TLS)
        |
        +-------------------------------+
        |                               |
        v                               v
Laravel App (Docker)              Web Dashboard
(API + Backend)                   (Static files)
        |
        +-------------------+
        |                   |
        v                   v
PostgreSQL (Docker)        Redis (Docker)
```

---

## 🚀 Quick Start - Local Development

```bash
# Clone repository
git clone https://github.com/your-org/Gate1System.git
cd Gate1System

# Start all services
docker compose up -d

# Install backend dependencies
docker compose exec app composer install

# Run migrations
docker compose exec app php artisan migrate

# Generate keys
docker compose exec app php artisan key:generate
docker compose exec app php artisan jwt:secret

# Access the app
# API: http://localhost:8080/api
# Health check: http://localhost:8080/api/health
```

---

## 🖥️ Server Setup (First Time Only)

### 1. Prepare VPS (Ubuntu 22.04)

```bash
# SSH into server
ssh nelium@157.173.112.150

# Run setup script
curl -fsSL https://raw.githubusercontent.com/your-org/Gate1System/main/deploy/server-setup.sh | sudo bash
```

### 2. Configure DNS

Point these domains to your server IP:
- `api.gate1.cloud` → 157.173.112.150
- `gate1.cloud` → 157.173.112.150

### 3. SSL Certificates

```bash
sudo certbot --nginx -d api.gate1.cloud -d gate1.cloud
```

### 4. Clone Repository

```bash
cd /opt/apps
git clone https://github.com/your-org/Gate1System.git gate1
cd gate1
```

### 5. Create Environment File

```bash
cp backend/.env.example backend/.env
nano backend/.env
# Fill in all required values (see below)
```

### 6. Start Services

```bash
docker compose up -d
docker compose exec app php artisan migrate --force
docker compose exec app php artisan key:generate
docker compose exec app php artisan jwt:secret
```

---

## 🔐 GitHub Secrets Setup

Go to **GitHub → Settings → Secrets and variables → Actions**

| Secret | Description | Example |
|--------|-------------|---------|
| `SSH_HOST` | Server IP | `157.173.112.150` |
| `SSH_USER` | SSH username | `nelium` |
| `SSH_KEY` | Private SSH key | `-----BEGIN OPENSSH...` |
| `APP_KEY` | Laravel app key | `base64:xxx...` |
| `DB_PASSWORD` | Database password | `strong-random-password` |
| `JWT_SECRET` | JWT secret | `xxx...` |

See `deploy/GITHUB_SECRETS.md` for detailed instructions.

---

## 🔄 Automated Deployment

### How It Works

1. Push code to `main` branch
2. GitHub Actions triggers automatically
3. Builds and tests backend & frontend
4. SSHs into server
5. Pulls latest code
6. Rebuilds Docker containers
7. **Runs migrations automatically**
8. Clears and rebuilds caches
9. Deploys web dashboard
10. Health check verification

### Trigger Deployment

```bash
# Push to main triggers deploy
git push origin main

# Or manually trigger from GitHub Actions tab
```

### Skip Migrations (if needed)

Use the workflow dispatch option in GitHub Actions UI with `skip_migrations: true`

---

## 📊 Migration Management

Migrations run automatically on every deployment. Laravel tracks which migrations have already run in the `migrations` table.

### Manual Migration Commands

```bash
# Run pending migrations
docker compose exec app php artisan migrate --force

# Check migration status
docker compose exec app php artisan migrate:status

# Rollback last batch
docker compose exec app php artisan migrate:rollback

# Fresh install (DANGER: drops all tables)
docker compose exec app php artisan migrate:fresh --seed
```

---

## 🐳 Docker Services

| Container | Purpose | Port |
|-----------|---------|------|
| `gate1-app` | Laravel + Nginx | 8080 (internal) |
| `gate1-db` | PostgreSQL | 5432 (internal) |
| `gate1-redis` | Cache & Queues | 6379 (internal) |
| `gate1-worker` | Queue processor | - |
| `gate1-scheduler` | Task scheduler | - |

### Common Commands

```bash
# View logs
docker compose logs -f app

# Restart services
docker compose restart

# Enter container shell
docker compose exec app sh

# Run artisan commands
docker compose exec app php artisan <command>

# Rebuild containers
docker compose build --no-cache
docker compose up -d
```

---

## 🔧 Maintenance

### Clear Caches

```bash
docker compose exec app php artisan cache:clear
docker compose exec app php artisan config:clear
docker compose exec app php artisan route:clear
docker compose exec app php artisan view:clear
```

### Maintenance Mode

```bash
# Enable
docker compose exec app php artisan down --retry=60

# Disable
docker compose exec app php artisan up
```

### Database Backup

```bash
docker compose exec db pg_dump -U gate1 gate1 > backup_$(date +%Y%m%d).sql
```

### Database Restore

```bash
docker compose exec -T db psql -U gate1 gate1 < backup.sql
```

---

## 🌐 URLs

| Service | URL |
|---------|-----|
| **API** | https://api.gate1system.com/api |
| **Web Dashboard** | https://gate1system.com |
| **Health Check** | https://api.gate1system.com/api/health |
| **Mobile App** | Expo build / App stores |

---

## 📱 Mobile App Deployment

```bash
cd mobile-app

# Development
npx expo start

# Production build (Android)
eas build --platform android --profile production

# Production build (iOS)
eas build --platform ios --profile production
```

---

## 🆘 Troubleshooting

### Container won't start
```bash
docker compose logs app
docker compose down && docker compose up -d
```

### Database connection failed
```bash
docker compose exec app php artisan config:clear
docker compose restart db
```

### Permission denied
```bash
docker compose exec app chown -R www-data:www-data /var/www/storage
docker compose exec app chmod -R 775 /var/www/storage
```

### Queue not processing
```bash
docker compose restart worker
docker compose logs worker
```

---

## 📋 Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Database backed up
- [ ] DNS configured

### Post-Deployment
- [ ] Health check passing
- [ ] Login working
- [ ] API responding
- [ ] Queues processing
- [ ] Logs clean

---

**Powered by Nelium Systems**
**© 2025 Gate1 System**
