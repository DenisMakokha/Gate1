#!/bin/bash
# Gate1 System - VPS Deployment Script
# This script handles full deployment: pull code, rebuild containers, run migrations, build frontend

set -e

# Configuration
APP_DIR="/opt/apps/gate1"
LOG_FILE="/var/log/gate1-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as correct user
cd "$APP_DIR" || error "Cannot change to $APP_DIR"

log "=========================================="
log "Starting Gate1 Deployment"
log "=========================================="

# Start SSH agent and add key
log "Setting up SSH agent..."
eval "$(ssh-agent -s)" > /dev/null 2>&1
ssh-add ~/.ssh/github_deploy 2>/dev/null || warn "SSH key may already be loaded"

# Pull latest code
log "Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main

# Stop containers gracefully
log "Stopping containers..."
docker compose down --remove-orphans

# Rebuild backend container
log "Rebuilding backend container..."
docker compose build --no-cache app

# Start all containers
log "Starting containers..."
docker compose up -d

# Wait for containers to be ready
log "Waiting for containers to be healthy..."
sleep 10

# Fix permissions
log "Fixing storage permissions..."
docker compose exec -T app sh -c "chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache"
docker compose exec -T app sh -c "chmod -R 775 /var/www/storage /var/www/bootstrap/cache"

# Install composer dependencies
log "Installing composer dependencies..."
docker compose exec -T app composer install --no-dev --optimize-autoloader

# Clear caches
log "Clearing Laravel caches..."
docker compose exec -T app php artisan config:clear
docker compose exec -T app php artisan cache:clear
docker compose exec -T app php artisan route:clear
docker compose exec -T app php artisan view:clear

# Run migrations
log "Running database migrations..."
docker compose exec -T app php artisan migrate --force

# Optimize for production
log "Optimizing for production..."
docker compose exec -T app php artisan config:cache
docker compose exec -T app php artisan route:cache
docker compose exec -T app php artisan view:cache

# Build web dashboard
log "Building web dashboard..."
cd "$APP_DIR/web-dashboard"
npm install --silent
echo "VITE_API_URL=https://api.gate1.cloud/api" > .env
npm run build

# Restart nginx to pick up any changes
log "Reloading nginx..."
sudo systemctl reload nginx

# Health check
log "Running health check..."
HEALTH_RESPONSE=$(curl -s http://localhost:8080/api/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    log "Health check passed!"
else
    error "Health check failed: $HEALTH_RESPONSE"
fi

log "=========================================="
log "Deployment completed successfully!"
log "=========================================="

# Show container status
docker compose ps
