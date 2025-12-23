# Gate 1 System - Quick Start Guide

## Prerequisites

- PHP 8.1+ with MySQL
- Node.js 18+
- Composer
- Git

---

## 1. Backend Setup

```bash
cd backend

# Install dependencies
composer install

# Copy environment file
copy .env.example .env

# Edit .env with your database credentials
# DB_DATABASE=gate1system
# DB_USERNAME=root
# DB_PASSWORD=your_password

# Generate keys
php artisan key:generate
php artisan jwt:secret

# Create database
# CREATE DATABASE gate1system;

# Run migrations and seed
php artisan migrate
php artisan db:seed

# Start server
php artisan serve
```

Backend will run at: `http://localhost:8000`

---

## 2. Web Dashboard Setup

```bash
cd web-dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

Dashboard will run at: `http://localhost:3000`

---

## 3. Desktop Agent Setup

```bash
cd desktop-agent

# Install dependencies
npm install

# Start in development mode
npm start
```

---

## 4. Mobile App Setup

```bash
cd mobile-app

# Install dependencies
npm install

# Start Expo
npx expo start
```

Scan QR code with Expo Go app.

---

## 5. Create First Admin User

```bash
cd backend
php artisan tinker
```

```php
$user = \App\Models\User::create([
    'name' => 'Admin User',
    'email' => 'admin@gate1system.org',
    'password' => bcrypt('password123'),
]);
$role = \App\Models\Role::where('slug', 'admin')->first();
$user->roles()->attach($role->id);
exit
```

---

## 6. Login

- **Web Dashboard**: http://localhost:3000
- **Email**: admin@gate1system.org
- **Password**: password123

---

## Default Roles

| Role | Slug | Description |
|------|------|-------------|
| Administrator | admin | Full access |
| Editor | editor | Copy, rename, backup |
| Group Leader | group-leader | Monitor team |
| QA Team | qa | Review issues |
| Backup Team | backup | Verify backups |

---

## Project Structure

```
Gate1System/
├── backend/          # PHP/Laravel API
├── web-dashboard/    # React Admin UI
├── desktop-agent/    # Electron Editor App
├── mobile-app/       # React Native Leadership App
└── docs/             # Documentation
```

---

## Documentation

- `docs/TRAINING_MANUAL_EDITORS.md`
- `docs/TRAINING_MANUAL_GROUP_LEADERS.md`
- `docs/TRAINING_MANUAL_QA_TEAM.md`
- `docs/TRAINING_MANUAL_BACKUP_TEAM.md`
- `docs/TRAINING_MANUAL_ADMIN.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/DEPLOYMENT_GUIDE.md`

---

## Support

For issues, check the documentation or review audit logs in the admin dashboard.
