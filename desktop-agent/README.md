# Gate 1 System - Desktop Agent

Electron-based desktop application for editors to manage SD cards, file renaming, and backups.

## Features

- SD Card detection and identification
- Camera/SD binding
- Copy verification with progress tracking
- Filename parsing and guidance
- Issue reporting
- Backup mode with checksum verification
- Offline queue for sync

## Installation

```bash
npm install
```

## Development

```bash
npm start
```

## Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Configuration

On first launch:
1. Login with your Gate 1 System credentials
2. Enter your name and group code
3. Configure watched folders

## Usage

1. Insert SD card - Agent detects and identifies it
2. Bind new SD cards to camera numbers
3. Copy files to your working folder
4. Rename files following the format: `FULLNAME_AGE_CONDITION_REGION.mp4`
5. Agent provides guidance on naming issues
6. Report quality issues through the Agent
7. Backup files to registered disks
8. Wait for "Safe to Remove" before ejecting SD

## Tray Icon States

- 🟢 Green: Connected and syncing
- 🟡 Yellow: Offline / waiting
- 🔴 Red: Error (needs attention)
- 🔵 Blue: Initial setup / scanning
