# Gate 1 System - Mobile App

React Native / Expo mobile application for Admin, Team Lead, Group Leaders, QA Team, and Backup Team.

## Features

- Real-time notifications for issues
- Issue acknowledgment and resolution
- Team monitoring and status
- Quick contact (call/WhatsApp)
- Role-based dashboards with scoped KPIs
- **Search & Playback** with role-based restrictions
- **Video playback** with source priority (Backup > Editor > QA Cache)
- **Download capability** for Admin/Team Lead only
- **Audit logging** for all playback and download actions
- Offline capability

## Installation

```bash
npm install
```

## Development

```bash
npx expo start
```

Scan the QR code with Expo Go app on your device.

## Build

### Using EAS Build (Recommended)

```bash
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

### Using Expo Build

```bash
npx expo build:android
npx expo build:ios
```

## Configuration

Update the API base URL in `src/services/api.js`:

```javascript
const API_BASE_URL = 'https://your-api-domain.com/api';
```

## Screens

| Screen | Description | Roles |
|--------|-------------|-------|
| Login | Authentication | All |
| Dashboard | Role-specific overview with KPIs | All |
| Search & Playback | Role-restricted media search | Admin, Team Lead, Group Leader, QA |
| Issues | Issue list and management | All |
| Issue Detail | View and resolve issues | All |
| Team Status | Team monitoring | Admin, Team Lead, Group Leader |
| Backup Analytics | Coverage by group & editor | Backup, Backup Lead |
| Profile | User info and settings | All |

## Roles Supported

- **Admin**: Full access, global search, download, live operations
- **Team Lead**: Same as Admin - operational oversight
- **Group Leader**: Monitor team, respond to alerts, group-scoped search
- **QA Lead**: QA oversight, issue-only search
- **QA**: Review issues, issue-only search, no download
- **Backup Lead**: Backup oversight, coverage monitoring
- **Backup**: Monitor coverage, verify backups, no playback
- **Editor**: Limited mobile access (desktop agent primary)

## Search & Playback Restrictions

| Role | Can Search By | Can Playback | Can Download |
|------|--------------|--------------|---------------|
| Admin/Team Lead | Name, Region, Condition, Camera, Issues | ✅ All | ✅ Yes |
| Group Leader | Camera, Issues (group-scoped) | ✅ Group only | ❌ No |
| QA | Camera, Issue Type (issues only) | ✅ Issues only | ❌ No |
| Backup | N/A | ❌ No | ❌ No |

## Playback Source Priority

1. **Verified Backup** (preferred) - Green indicator
2. **Editor Stream** (live) - Blue indicator, when editor online
3. **QA Review Cache** - Yellow, compressed/watermarked
4. **Offline** - Red, playback blocked

## Backup Team Features (Critical)

The mobile app is **critical** for Backup team daily operations:

### Backup Operations Screen
- **Real-time monitoring** - Auto-refresh every 10 seconds
- **Disk status** - Online/offline, capacity, usage percentage
- **Pending files queue** - Priority-sorted with waiting time
- **Today's activity** - Files backed up, verified, data transferred
- **Critical alerts** - Disk offline, disk full, high pending count (with vibration)

### Coverage Tracking
- **By Editor** - See which editors have pending backups
- **By Group** - Track backup coverage per group
- **Progress bars** - Color-coded (green ≥90%, yellow ≥50%, red <50%)

### Dashboard Quick Actions
- **Backup Operations** - Jump to real-time monitoring
- **Coverage Analytics** - Detailed breakdown
- **Disk Status** - Hardware health check

### Dedicated Tab
Backup team sees a **Backups** tab in bottom navigation for quick access.

## Tech Stack

- React Native
- Expo SDK 50
- React Navigation
- Axios
- AsyncStorage
