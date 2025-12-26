# Gate 1 System
## Deployment Guide
### Version 1.0

---

## 1. Prerequisites

### Server Requirements
- PHP 8.1 or higher
- MySQL 8.0 or higher
- Composer 2.x
- Node.js 18+ (for builds)
- Git

### Development Machine
- Node.js 18+
- npm or yarn
- Electron (for desktop agent)
- Expo CLI (for mobile app)

---

## 2. Backend Deployment

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd Gate1System/backend
```

### Step 2: Install Dependencies
```bash
composer install --optimize-autoloader --no-dev
```

### Step 3: Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` file:
```env
APP_NAME="Gate 1 System"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_CONNECTION=mysql
DB_HOST=your-db-host
DB_PORT=3306
DB_DATABASE=gate1system
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password

JWT_SECRET=your-jwt-secret
```

### Step 4: Generate Keys
```bash
php artisan key:generate
php artisan jwt:secret
```

### Step 5: Database Setup
```bash
php artisan migrate --force
php artisan db:seed --force
```

### Step 6: Optimize
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Step 7: Web Server Configuration

#### Nginx Example
```nginx
server {
    listen 80;
    server_name api.gate1.cloud;
    root /var/www/gate1system/backend/public;

    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

---

## 3. Web Dashboard Deployment

### Step 1: Build
```bash
cd Gate1System/web-dashboard
npm install
npm run build
```

### Step 2: Deploy
Upload contents of `dist/` folder to:
- Netlify
- Vercel
- Any static hosting

### Step 3: Configure API URL
In production, update `src/services/api.js`:
```javascript
const API_BASE_URL = 'https://api.gate1.cloud/api';
```

---

## 4. Desktop Agent Deployment

### Step 1: Configure API
Edit `src/main.js`:
```javascript
const API_BASE_URL = 'https://api.gate1.cloud/api';
```

### Step 2: Build for Windows
```bash
cd Gate1System/desktop-agent
npm install
npm run build:win
```

Output: `dist/Gate 1 Agent Setup.exe`

### Step 3: Build for macOS
```bash
npm run build:mac
```

Output: `dist/Gate 1 Agent.dmg`

### Step 4: Distribution
- Sign the executables (recommended)
- Distribute via internal channels
- Set up auto-update server (optional)

---

## 5. Mobile App Deployment

### Development Build
```bash
cd Gate1System/mobile-app
npm install
npx expo start
```

### Production Build (Expo)
```bash
# Android
npx expo build:android

# iOS
npx expo build:ios
```

### EAS Build (Recommended)
```bash
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

---

## 6. Database Backup

### Manual Backup
```bash
mysqldump -u user -p gate1system > backup_$(date +%Y%m%d).sql
```

### Automated Backup (Cron)
```bash
0 2 * * * mysqldump -u user -p gate1system > /backups/gate1_$(date +\%Y\%m\%d).sql
```

---

## 7. SSL/HTTPS Setup

### Let's Encrypt (Certbot)
```bash
sudo certbot --nginx -d api.gate1system.org
sudo certbot --nginx -d app.gate1system.org
```

---

## 8. Monitoring Setup

### Health Check Endpoint
```
GET /api/health
```

### Recommended Tools
- UptimeRobot (uptime monitoring)
- Laravel Telescope (debugging)
- Sentry (error tracking)

---

## 9. First Admin User

### Create via Tinker
```bash
php artisan tinker
```

```php
$user = \App\Models\User::create([
    'name' => 'Admin User',
    'email' => 'admin@gate1.cloud',
    'password' => bcrypt('secure-password'),
]);

$adminRole = \App\Models\Role::where('slug', 'admin')->first();
$user->roles()->attach($adminRole->id);
```

---

## 10. Troubleshooting

### Common Issues

**500 Error**
- Check storage permissions: `chmod -R 775 storage bootstrap/cache`
- Check `.env` configuration
- Review `storage/logs/laravel.log`

**JWT Token Issues**
- Regenerate: `php artisan jwt:secret`
- Clear config: `php artisan config:clear`

**Database Connection**
- Verify credentials in `.env`
- Check MySQL is running
- Test connection manually

---

## 11. Update Procedure

```bash
# Pull latest code
git pull origin main

# Update dependencies
composer install --optimize-autoloader --no-dev

# Run migrations
php artisan migrate --force

# Clear caches
php artisan config:clear
php artisan cache:clear
php artisan route:clear

# Rebuild caches
php artisan config:cache
php artisan route:cache
```

---

## 12. Security Checklist

- [ ] APP_DEBUG=false in production
- [ ] Strong JWT_SECRET
- [ ] HTTPS enabled
- [ ] Database credentials secured
- [ ] Regular backups configured
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured

---

*Gate 1 System - Deployment Guide*
