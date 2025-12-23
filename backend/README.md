# Gate 1 System - Backend API

PHP/Laravel backend for the Gate 1 System (MCQEMS).

## Requirements

- PHP 8.1+
- MySQL 8.0+
- Composer

## Installation

```bash
# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Generate JWT secret
php artisan jwt:secret

# Run migrations
php artisan migrate

# Seed roles
php artisan db:seed

# Start development server
php artisan serve
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user

### Agent (Desktop App)
- `POST /api/agent/register` - Register agent
- `POST /api/agent/heartbeat` - Agent heartbeat
- `GET /api/agent/config` - Get agent configuration
- `POST /api/agent/sd-card/bind` - Bind SD card to camera
- `GET /api/agent/sd-card` - Get SD card info

### Sessions
- `POST /api/session/start` - Start camera session
- `PUT /api/session/{id}/progress` - Update copy progress
- `POST /api/session/{id}/end` - End session
- `GET /api/session/{id}` - Get session details

### Media
- `POST /api/media/sync` - Sync media metadata
- `POST /api/media/batch-sync` - Batch sync
- `GET /api/media/search` - Search media (Admin only)
- `GET /api/media/{id}/status` - Get media status

### Issues
- `GET /api/issues` - List issues
- `POST /api/issues/report` - Report issue
- `POST /api/issues/{id}/acknowledge` - Acknowledge issue
- `POST /api/issues/{id}/resolve` - Resolve issue
- `POST /api/issues/{id}/escalate` - Escalate issue

### Backup
- `POST /api/backup/disk/register` - Register backup disk
- `POST /api/backup/create` - Create backup
- `POST /api/backup/verify` - Verify backup
- `GET /api/backup/coverage` - Get backup coverage

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event (Admin)
- `GET /api/events/{id}` - Get event details
- `PUT /api/events/{id}` - Update event (Admin)

### Groups
- `GET /api/groups` - List groups
- `POST /api/groups` - Create group (Admin)
- `GET /api/groups/{id}/members` - Get group members
- `POST /api/groups/validate` - Validate group code

### Dashboards
- `GET /api/dashboard/admin` - Admin dashboard
- `GET /api/dashboard/group-leader` - Group leader dashboard
- `GET /api/dashboard/qa` - QA dashboard
- `GET /api/dashboard/backup` - Backup dashboard
- `GET /api/dashboard/editor` - Editor dashboard

## Roles

| Role | Slug | Description |
|------|------|-------------|
| Administrator | `admin` | Full system access |
| Editor | `editor` | Copy, rename, report, backup |
| Group Leader | `group-leader` | Monitor group, coordinate |
| QA Team | `qa` | Review issues, confirm fixes |
| Backup Team | `backup` | Verify backups, disk rotation |
