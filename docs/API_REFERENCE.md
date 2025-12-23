# Gate 1 System
## API Reference
### Version 1.0

---

## Base URL
```
https://api.gate1system.org/api
```

## Authentication
All protected endpoints require JWT Bearer token:
```
Authorization: Bearer <token>
```

---

## 1. Authentication Endpoints

### POST /auth/login
Login and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": "success",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "roles": ["editor"]
  },
  "authorization": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "type": "bearer",
    "expires_in": 3600
  }
}
```

### POST /auth/register
Register new user.

**Request:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123",
  "password_confirmation": "password123",
  "phone": "+254700000000"
}
```

### POST /auth/logout
Logout current user.

### POST /auth/refresh
Refresh JWT token.

### GET /auth/me
Get current user info.

---

## 2. Agent Endpoints

### POST /agent/register
Register desktop agent.

**Request:**
```json
{
  "editor_name": "John Doe",
  "device_id": "DEV-ABC123",
  "os": "Windows 11",
  "agent_version": "1.0.0",
  "group_code": "G-07"
}
```

**Response:**
```json
{
  "status": "verified",
  "agent_id": "EDT-001",
  "sync_mode": "metadata_only",
  "settings": {
    "expected_filename_format": "FULLNAME_AGE_CONDITION_REGION"
  }
}
```

### POST /agent/heartbeat
Send agent heartbeat.

**Request:**
```json
{
  "agent_id": "EDT-001",
  "device_id": "DEV-ABC123",
  "status": "online",
  "latency_ms": 42,
  "watched_folders": ["Before Interviews", "After Healing"]
}
```

### GET /agent/config
Get agent configuration.

### POST /agent/sd-card/bind
Bind SD card to camera.

**Request:**
```json
{
  "hardware_id": "SD-ABC123",
  "fs_uuid": "uuid-string",
  "camera_number": 10,
  "sd_label": "B",
  "capacity_bytes": 32000000000
}
```

### GET /agent/sd-card
Get SD card info by hardware_id.

---

## 3. Session Endpoints

### POST /session/start
Start camera session.

**Request:**
```json
{
  "event_id": 1,
  "sd_card_id": 5,
  "camera_number": 10,
  "device_id": "DEV-ABC123",
  "files_detected": 142,
  "total_size_bytes": 38400000000
}
```

**Response:**
```json
{
  "status": "started",
  "session": {
    "session_id": "SESS-10B-2025-ABC1",
    "camera_number": 10,
    "sd_label": "B",
    "files_detected": 142
  }
}
```

### PUT /session/{sessionId}/progress
Update copy progress.

**Request:**
```json
{
  "files_copied": 96,
  "files_pending": 46
}
```

### POST /session/{sessionId}/end
End session.

**Request:**
```json
{
  "removal_decision": "safe",
  "files_copied": 142,
  "files_pending": 0
}
```

---

## 4. Media Endpoints

### POST /media/sync
Sync media metadata.

**Request:**
```json
{
  "agent_id": "EDT-001",
  "device_id": "DEV-ABC123",
  "file": {
    "filename": "ROSE_AWITI_34_CRIPPLE_KISUMUWEST.mp4",
    "original_path": "/HealingVideos/Before/",
    "type": "before",
    "size_bytes": 124512334,
    "checksum": "sha256:abc123..."
  },
  "parsed_metadata": {
    "full_name": "ROSE AWITI",
    "age": 34,
    "condition": "CRIPPLE",
    "region": "KISUMU WEST"
  },
  "event_id": 1
}
```

**Response:**
```json
{
  "status": "synced",
  "media_id": "MED-ABC12345"
}
```

### POST /media/batch-sync
Batch sync multiple files.

### GET /media/search
Search media (Admin only).

**Query Parameters:**
- `full_name` - Search by name
- `condition` - Filter by condition
- `region` - Filter by region
- `event_id` - Filter by event
- `status` - Filter by status
- `type` - before/after
- `per_page` - Results per page

### GET /media/{mediaId}/status
Get media status.

---

## 5. Issue Endpoints

### GET /issues
List issues (role-filtered).

**Query Parameters:**
- `status` - open, acknowledged, resolved, etc.
- `severity` - low, medium, high, critical
- `type` - Issue type
- `group_id` - Filter by group

### POST /issues/report
Report new issue.

**Request:**
```json
{
  "media_id": "MED-ABC12345",
  "type": "no_audio",
  "severity": "high",
  "description": "No audio in the entire recording"
}
```

### GET /issues/{issueId}
Get issue details.

### POST /issues/{issueId}/acknowledge
Acknowledge issue.

### POST /issues/{issueId}/resolve
Resolve issue.

**Request:**
```json
{
  "resolution_notes": "Audio confirmed present after re-check"
}
```

### POST /issues/{issueId}/escalate
Escalate issue.

**Request:**
```json
{
  "reason": "Cannot resolve at group level"
}
```

### GET /issues/group-summary
Get issues summary by group.

---

## 6. Backup Endpoints

### POST /backup/disk/register
Register backup disk.

**Request:**
```json
{
  "hardware_id": "DISK-XYZ789",
  "name": "Backup Disk 1",
  "purpose": "primary",
  "capacity_bytes": 1000000000000
}
```

### POST /backup/create
Create backup record.

**Request:**
```json
{
  "media_id": "MED-ABC12345",
  "backup_disk_id": 1,
  "backup_path": "/backups/event1/file.mp4",
  "checksum": "sha256:xyz789..."
}
```

### POST /backup/verify
Verify backup.

**Request:**
```json
{
  "media_id": "MED-ABC12345",
  "backup_disk_id": 1,
  "checksum": "sha256:xyz789..."
}
```

### GET /backup/coverage
Get backup coverage stats.

### GET /backup/pending
Get pending backups list.

### GET /backup/disk/{diskId}
Get disk status.

---

## 7. Event Endpoints

### GET /events
List all events.

### GET /events/active
Get active events.

### POST /events
Create event (Admin only).

**Request:**
```json
{
  "name": "Healing Service January 2025",
  "description": "Monthly healing service",
  "location": "Nairobi",
  "start_date": "2025-01-15",
  "end_date": "2025-01-17"
}
```

### GET /events/{id}
Get event details.

### PUT /events/{id}
Update event (Admin only).

### POST /events/{id}/activate
Activate event.

### POST /events/{id}/complete
Complete event.

### GET /events/{id}/stats
Get event statistics.

---

## 8. Group Endpoints

### GET /groups
List groups.

### POST /groups
Create group (Admin only).

**Request:**
```json
{
  "name": "Blue Team - Camera 3",
  "description": "Handles cameras 3-5",
  "event_id": 1,
  "leader_id": 5,
  "leader_phone": "+254700000000"
}
```

### GET /groups/{id}
Get group details.

### PUT /groups/{id}
Update group.

### GET /groups/{id}/members
Get group members.

### POST /groups/{id}/members
Add member to group.

### DELETE /groups/{id}/members
Remove member from group.

### POST /groups/validate
Validate group code.

---

## 9. Dashboard Endpoints

### GET /dashboard/admin
Admin dashboard data.

### GET /dashboard/group-leader
Group leader dashboard.

### GET /dashboard/qa
QA dashboard.

### GET /dashboard/backup
Backup dashboard.

### GET /dashboard/editor
Editor dashboard.

---

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "field": ["Error message"]
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthenticated"
}
```

### 403 Forbidden
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "status": "duplicate",
  "message": "Resource already exists"
}
```

---

*Gate 1 System - API Reference*
