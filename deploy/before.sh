#!/bin/bash
# Gate1 System - Pre-Deployment Script
# Runs before deployment starts

set -e

echo "📦 Pre-deployment tasks starting..."

# Backup current state (optional)
if [ -f "/opt/apps/gate1/backend/.env" ]; then
    echo "📋 Backing up current .env..."
    cp /opt/apps/gate1/backend/.env /opt/apps/gate1/backend/.env.backup.$(date +%Y%m%d%H%M%S)
fi

# Create required directories if they don't exist
echo "📁 Ensuring directory structure..."
mkdir -p /opt/apps/gate1/backend/storage/logs
mkdir -p /opt/apps/gate1/backend/storage/framework/cache
mkdir -p /opt/apps/gate1/backend/storage/framework/sessions
mkdir -p /opt/apps/gate1/backend/storage/framework/views
mkdir -p /opt/apps/gate1/backend/bootstrap/cache
mkdir -p /opt/apps/gate1/backend/public/dashboard

# Put application in maintenance mode (if running)
if docker compose ps | grep -q "gate1-app"; then
    echo "🔧 Entering maintenance mode..."
    docker compose exec -T app php artisan down --retry=60 || true
fi

echo "✅ Pre-deployment tasks complete"
