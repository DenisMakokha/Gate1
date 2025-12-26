# Gate1 System - Required GitHub Secrets

## Setup Instructions

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:

---

## Required Secrets

### `SSH_HOST`
Server IP address
```
157.173.112.150
```

### `SSH_USER`
SSH username for deployment
```
nelium
```

### `SSH_KEY`
Private SSH key for server access (entire content including BEGIN/END lines)
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAA...
...
-----END OPENSSH PRIVATE KEY-----
```

### `APP_KEY`
Laravel application key (generate with `php artisan key:generate --show`)
```
base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `DB_PASSWORD`
PostgreSQL database password (generate a strong random password)
```
your-strong-database-password-here
```

### `JWT_SECRET`
JWT authentication secret (generate with `php artisan jwt:secret --show`)
```
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Optional Secrets

### `MAIL_USERNAME`
SMTP username for email sending

### `MAIL_PASSWORD`
SMTP password for email sending

### `SLACK_WEBHOOK_URL`
Slack webhook for deployment notifications

---

## Environment Setup

In GitHub repository settings, create an **Environment** called `production`:

1. Go to **Settings** → **Environments**
2. Click **New environment**
3. Name it `production`
4. Optionally add protection rules (required reviewers, wait timer)

---

## Generate Keys Locally

```bash
# Generate APP_KEY
cd backend
php artisan key:generate --show

# Generate JWT_SECRET  
php artisan jwt:secret --show

# Generate strong password
openssl rand -base64 32
```

---

## SSH Key Setup

On your **local machine**:
```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "gate1-deploy" -f ~/.ssh/gate1_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/gate1_deploy.pub nelium@157.173.112.150

# Add private key content to GitHub Secret SSH_KEY
cat ~/.ssh/gate1_deploy
```
