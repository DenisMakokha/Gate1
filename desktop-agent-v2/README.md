# Gate 1 Desktop Agent v2 (Windows-first)

## Phase 1 (Foundation)
Implemented:
- Persistent `deviceId`
- Encrypted token storage via `keytar`
- API client wired to hosted API base URL
- IPC handlers for login / me / agent register
- Basic heartbeats (best-effort)

## Run (dev)
```bash
npm install
npm run dev
```

> Note: Offline queue + audit log are implemented in the next Phase 1 step.
