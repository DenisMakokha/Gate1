# Gate 1 System - Web Dashboard

React-based admin dashboard for managing the Gate 1 System.

## Features

- Role-based dashboards (Admin, Group Leader, QA, Backup, Editor)
- Event management
- Group management
- Global media search
- Issue tracking and resolution
- Backup coverage monitoring
- Audit log viewer

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## Build

```bash
npm run build
```

Output will be in the `dist/` folder.

## Configuration

Update the API base URL in `src/services/api.js`:

```javascript
const API_BASE_URL = 'https://your-api-domain.com/api';
```

## Pages

| Page | Access | Description |
|------|--------|-------------|
| Dashboard | All roles | Role-specific overview |
| Events | Admin | Create and manage events |
| Groups | Admin, Group Leader | Manage groups and members |
| Media | Admin | Global media search |
| Issues | Admin, Group Leader, QA | Issue tracking |
| Backups | Admin, Backup Team | Backup coverage |

## Tech Stack

- React 18
- Vite
- TailwindCSS
- React Router
- Axios
- Lucide Icons
