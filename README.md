# Gate 1 System

[![Deployment Status](https://img.shields.io/badge/deployment-live-brightgreen)](https://gate1.cloud)

**Media Chain, Quality & Evidence Management System (MCQEMS)**

A comprehensive platform for managing large-scale testimonial video operations with human-first workflows, evidence-grade traceability, and real-time quality correction.

---

## 🚀 Quick Start

See [QUICK_START.md](./QUICK_START.md) for setup instructions.

---

## 📁 Project Structure

```
Gate1System/
├── backend/          # PHP/Laravel REST API
├── web-dashboard/    # React Admin Dashboard
├── desktop-agent/    # Electron Editor App
├── mobile-app/       # React Native Leadership App
└── docs/             # Documentation & Training Manuals
```

---

## 🔧 Components

### 1. Backend (PHP/Laravel)
- REST API with JWT authentication
- Role-based access control (RBAC)
- MySQL database with 14 tables
- Audit logging

### 2. Desktop Agent (Electron)
- SD card detection and binding
- Copy verification with progress tracking
- Filename parsing and guidance
- Issue reporting
- Backup mode with checksum verification

### 3. Admin Web Dashboard (React)
- Role-based dashboards
- Event and group management
- Global media search
- Issue tracking and resolution
- Backup coverage monitoring

### 4. Mobile App (React Native/Expo)
- Group leader console
- Real-time notifications
- Issue acknowledgment and resolution
- Team monitoring
- Quick contact (call/WhatsApp)

---

## 👥 Roles

| Role | Slug | Responsibilities |
|------|------|-----------------|
| Administrator | `admin` | Full system access, event creation, role assignment |
| Editor | `editor` | Copy SD cards, rename files, report issues, backup |
| Group Leader | `group-leader` | Monitor group, respond to alerts, escalate issues |
| QA Team | `qa` | Review issues, confirm fixes |
| Backup Team | `backup` | Verify backups, disk rotation |

---

## 📋 Core Principles

1. **Human-First**: Editors rename manually; system guides, not automates
2. **Evidence-Grade**: Every action logged, immutable audit trail
3. **Group-Aware**: Issues escalate through group leaders first
4. **Verified Backups**: Nothing is safe until checksum-verified
5. **Dignity Preserved**: No surveillance, no blame - accountability with respect

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](./QUICK_START.md) | Setup instructions |
| [docs/SYSTEM_ARCHITECTURE.md](./docs/SYSTEM_ARCHITECTURE.md) | Technical architecture |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | API documentation |
| [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) | Production deployment |
| [docs/TRAINING_MANUAL_EDITORS.md](./docs/TRAINING_MANUAL_EDITORS.md) | Editor training |
| [docs/TRAINING_MANUAL_GROUP_LEADERS.md](./docs/TRAINING_MANUAL_GROUP_LEADERS.md) | Group leader training |
| [docs/TRAINING_MANUAL_QA_TEAM.md](./docs/TRAINING_MANUAL_QA_TEAM.md) | QA team training |
| [docs/TRAINING_MANUAL_BACKUP_TEAM.md](./docs/TRAINING_MANUAL_BACKUP_TEAM.md) | Backup team training |
| [docs/TRAINING_MANUAL_ADMIN.md](./docs/TRAINING_MANUAL_ADMIN.md) | Admin training |

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | PHP 8.1+, Laravel 10, MySQL 8 |
| Web Dashboard | React 18, Vite, TailwindCSS |
| Desktop Agent | Electron 28, Node.js 18 |
| Mobile App | React Native, Expo SDK 50 |
| Authentication | JWT (tymon/jwt-auth) |

---

## 📊 Key Features

- ✅ SD Card Detection & Binding
- ✅ Copy Verification Engine
- ✅ Safe Removal Confirmation
- ✅ Filename Parsing & Guidance
- ✅ Issue Reporting & Escalation
- ✅ Group-based Notifications
- ✅ Backup Verification (Checksum)
- ✅ Role-Based Access Control
- ✅ Immutable Audit Logging
- ✅ Gate 2 Healing Cases (Before/After Linkage)

---

## 📄 License

Proprietary - All Rights Reserved

---

*Gate 1 System - Preserving Evidence with Dignity*
