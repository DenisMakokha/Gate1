# Gate 1 System - Mobile App

React Native / Expo mobile application for Group Leaders, QA Team, and Backup Team.

## Features

- Real-time notifications for issues
- Issue acknowledgment and resolution
- Team monitoring and status
- Quick contact (call/WhatsApp)
- Role-based dashboards
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

| Screen | Description |
|--------|-------------|
| Login | Authentication |
| Dashboard | Role-specific overview |
| Issues | Issue list and management |
| Issue Detail | View and resolve issues |
| Team | Team members and status |
| Profile | User info and settings |

## Roles Supported

- **Group Leader**: Monitor team, respond to alerts, escalate
- **QA Team**: Review issues, confirm fixes
- **Backup Team**: Monitor coverage, verify backups
- **Admin**: Full access (limited mobile features)

## Tech Stack

- React Native
- Expo SDK 50
- React Navigation
- Axios
- AsyncStorage
