# Gate 1 System
## System Architecture Document
### Version 1.0

---

## 1. System Overview

Gate 1 System (MCQEMS - Media Chain, Quality & Evidence Management System) is a comprehensive platform for managing large-scale testimonial video operations with:

- Human-first workflows
- Evidence-grade traceability
- Real-time quality correction
- Verified backups
- Role-based access control

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GATE 1 SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Desktop    │  │     Web      │  │    Mobile    │          │
│  │    Agent     │  │  Dashboard   │  │     App      │          │
│  │  (Electron)  │  │   (React)    │  │(React Native)│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └────────────────┬┴─────────────────┘                   │
│                          │                                      │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │    REST API Layer     │                          │
│              │   (PHP / Laravel)     │                          │
│              └───────────┬───────────┘                          │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   MySQL    │  │   File     │  │  Audit     │                │
│  │  Database  │  │  Storage   │  │   Logs     │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Details

### 3.1 Desktop Agent (Electron + Node.js)

**Purpose**: Editor workstation tool for SD card handling and file management

**Features**:
- SD card detection and identification
- Camera/SD binding
- File watching and copy tracking
- Filename parsing and guidance
- Issue reporting
- Backup mode with verification
- Offline queue for sync

**Technology**:
- Electron 28+
- Node.js 18+
- chokidar (file watching)
- FFmpeg (thumbnails)

### 3.2 Web Dashboard (React + Vite)

**Purpose**: Admin and management interface

**Features**:
- Role-based dashboards
- Event management
- Group management
- Global media search
- Issue tracking
- Backup monitoring
- Audit log viewer

**Technology**:
- React 18
- Vite
- TailwindCSS
- React Router
- Axios

### 3.3 Mobile App (React Native / Expo)

**Purpose**: Leadership console for Group Leaders, QA, Backup teams

**Features**:
- Real-time notifications
- Issue acknowledgment and resolution
- Team monitoring
- Quick contact (call/WhatsApp)
- Offline capability

**Technology**:
- React Native
- Expo
- React Navigation

### 3.4 Backend API (PHP / Laravel)

**Purpose**: Central API and business logic

**Features**:
- RESTful API
- JWT authentication
- Role-based access control
- Media indexing
- Issue workflow
- Backup tracking
- Audit logging

**Technology**:
- PHP 8.1+
- Laravel 10
- MySQL 8.0+
- JWT Auth

---

## 4. Data Model

### Core Entities

```
users ─────────< user_roles >───────── roles
  │
  ├──< agents
  ├──< media
  ├──< issues (reported_by)
  └──< groups (leader_id)

events ─────────< groups
  │              │
  ├──< media     └──< group_members >── users
  └──< healing_cases

cameras ────────< sd_cards ────────< camera_sessions
                     │
                     └──< media

media ──────────< issues
  │
  ├──< backups ────── backup_disks
  └──< healing_cases (before/after)

audit_logs (immutable)
```

### Key Tables

| Table | Purpose |
|-------|---------|
| users | System users |
| roles | RBAC roles |
| events | Healing service events |
| groups | Editor groups with leaders |
| cameras | Registered cameras |
| sd_cards | SD card registry with bindings |
| camera_sessions | SD copy sessions |
| media | Indexed video files |
| issues | Quality issues |
| backup_disks | Registered backup disks |
| backups | Backup records with verification |
| healing_cases | Before/After linkage (Gate 2) |
| audit_logs | Immutable action logs |

---

## 5. Security Model

### Authentication
- JWT tokens with refresh
- Token expiry: 60 minutes
- Refresh expiry: 14 days

### Authorization (RBAC)
- 5 roles: Admin, Editor, Group Leader, QA, Backup
- Permission-based access
- Role middleware on API routes

### Data Protection
- Passwords hashed (bcrypt)
- API tokens encrypted
- Audit logs immutable
- Soft deletes for data retention

---

## 6. API Structure

### Authentication
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### Agent
```
POST /api/agent/register
POST /api/agent/heartbeat
GET  /api/agent/config
POST /api/agent/sd-card/bind
GET  /api/agent/sd-card
```

### Sessions
```
POST /api/session/start
PUT  /api/session/{id}/progress
POST /api/session/{id}/end
GET  /api/session/{id}
```

### Media
```
POST /api/media/sync
POST /api/media/batch-sync
GET  /api/media/search
GET  /api/media/{id}/status
```

### Issues
```
GET  /api/issues
POST /api/issues/report
POST /api/issues/{id}/acknowledge
POST /api/issues/{id}/resolve
POST /api/issues/{id}/escalate
```

### Backup
```
POST /api/backup/disk/register
POST /api/backup/create
POST /api/backup/verify
GET  /api/backup/coverage
```

---

## 7. Deployment

### Development
```bash
# Backend
cd backend
composer install
php artisan migrate
php artisan db:seed
php artisan serve

# Web Dashboard
cd web-dashboard
npm install
npm run dev

# Desktop Agent
cd desktop-agent
npm install
npm start

# Mobile App
cd mobile-app
npm install
npx expo start
```

### Production
- Backend: PHP hosting with MySQL
- Web: Static hosting (Netlify, Vercel)
- Desktop: Electron builds (.exe, .dmg)
- Mobile: App stores or Expo builds

---

## 8. Scalability

### Current Design Supports
- 10,000+ videos per event
- 50+ concurrent editors
- 100+ groups
- Multiple simultaneous events

### Future Scaling
- Database read replicas
- CDN for thumbnails
- Queue workers for async tasks
- Cloud storage integration

---

## 9. Monitoring

### Key Metrics
- API response times
- Agent online count
- Backup coverage percentage
- Issue resolution rate
- Error rates

### Logging
- Application logs
- Audit logs (immutable)
- Agent sync logs

---

*Gate 1 System - Architecture for Scale*
