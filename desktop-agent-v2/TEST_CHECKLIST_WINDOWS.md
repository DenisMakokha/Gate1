# Gate 1 Agent — Windows Laptop Test Checklist

This checklist is meant to validate the single NSIS setup EXE end-to-end on a Windows laptop.

## 0) Prep

- Confirm you have the installer EXE:
  - `desktop-agent-v2\\release\\Gate 1 Agent-Setup-<version>-x64.exe`
- Confirm API URL is production (should be automatic):
  - `https://api.gate1.cloud/api`

## 1) Install (NSIS)

- Run the Setup EXE.
- Verify installer shows:
  - branded header + sidebar images
  - license page
  - “Powered by Nelium Systems” captions
- Choose install directory (default is OK).
- Finish installation.

Expected:
- Desktop shortcut created
- Start Menu shortcut created under `Nelium Systems\\Gate 1`
- App launches after finish (if selected)

## 2) First launch: Login + Registration

- App should open to the Login screen (no tabs visible yet).
- Sign in with valid credentials.
- Register:
  - Editor name
  - Optional group code

Expected:
- After registration, normal tabs appear.
- Header pill shows:
  - **Ready** (blue) when online but not yet live

## 3) Connectivity indicators

### Online/offline
- With internet ON:
  - mascot tint should be **blue** (or **green** only if live session)
  - header pill: **Ready** (blue) or **Live** (green)
- Turn internet OFF:
  - mascot tint becomes **red**
  - header pill becomes **Offline** (red)
  - one-time bubble: “Offline. Saving locally until internet returns.”

### Back online
- Turn internet ON again:
  - header returns to Ready/Live
  - one-time bubble: “Back online. Syncing now.”

## 4) SD session workflow (Windows-only features)

- Insert an SD card.

Expected:
- Session starts / SD recognized.
- Today shows session status.

## 5) Copy + rename prompt + report issue

- Copy a few media clips into the watched folder.
- Rename one clip.

Expected:
- Mascot bubble: “Issue with this clip?”
- Today dropdown `Report an issue…` is available
- Choose a preset issue:
  - should toast success
- Choose “Other…” and submit text:
  - should toast success

## 6) Issues tab

- Open Issues tab.

Expected:
- Shows a list of issues.
- Status shows **Open** for new items.
- No editor form / no ack button.

## 7) Backup workflow

- Ensure a backup disk is connected.

Expected:
- Mascot bubble indicates backup disk is ready (when detected)
- Today shows **Start backup** when backupReady is true
- Start backup

Expected:
- Backup progresses.
- Backup page shows completeness percentage and pending list.

## 8) Offline queue resilience (quick sanity)

- Turn internet OFF.
- Trigger any action that would normally hit the server (e.g., heartbeat runs; issue report; SD bind if applicable).
- Turn internet ON.

Expected:
- Queue drains eventually.
- No crashes.

## 9) Auto-start on login

- Reboot Windows OR log out/in.

Expected:
- App auto-starts hidden (tray), not popping the window.
- Tray icon is present.
- Clicking tray shows main window.

## 10) Uninstall

- Use Windows “Apps & Features” or Control Panel uninstall.

Expected:
- App removed.
- Start Menu/desktop shortcuts removed.
- Auto-start registry entry removed.

## Notes / What to report back

- Screenshot of installer pages
- Any SmartScreen prompts (unsigned vs signed)
- Any place where a non-technical editor would get stuck
- Any missing/incorrect branding text
