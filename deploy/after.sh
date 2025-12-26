#!/bin/bash
# Gate1 System - Post-Deployment Script
# Runs after deployment completes

set -e

echo "✅ Post-deployment tasks starting..."

# Bring application out of maintenance mode
echo "🚀 Exiting maintenance mode..."
docker compose exec -T app php artisan up || true

# Clear any stale cache
echo "🧹 Clearing stale caches..."
docker compose exec -T app php artisan cache:clear || true

# Restart queue workers to pick up new code
echo "🔄 Restarting queue workers..."
docker compose restart worker || true

# Log deployment
echo "📝 Logging deployment..."
echo "Deployed at $(date)" >> /opt/apps/gate1/deploy/deployment.log

# Optional: Send notification (webhook, Slack, etc.)
# curl -X POST -H 'Content-type: application/json' \
#   --data '{"text":"Gate1 deployed successfully!"}' \
#   $SLACK_WEBHOOK_URL

echo "✅ Post-deployment tasks complete"
echo "🎉 Gate1 System is now live!"
