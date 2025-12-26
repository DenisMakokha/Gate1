<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\BackupDisk;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BackupController extends Controller
{
    public function registerDisk(Request $request): JsonResponse
    {
        $request->validate([
            'hardware_id' => 'required|string',
            'name' => 'required|string|max:255',
            'purpose' => 'nullable|in:primary,secondary,offsite',
            'capacity_bytes' => 'nullable|integer',
        ]);

        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isBackupTeam()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $disk = BackupDisk::updateOrCreate(
            ['hardware_id' => $request->hardware_id],
            [
                'name' => $request->name,
                'purpose' => $request->purpose ?? 'primary',
                'capacity_bytes' => $request->capacity_bytes,
                'status' => 'active',
                'last_used_at' => now(),
            ]
        );

        AuditLog::log('backup_disk.register', $user, 'BackupDisk', $disk->id);

        return response()->json([
            'status' => 'registered',
            'disk_id' => $disk->id,
            'name' => $disk->name,
        ]);
    }

    public function backup(Request $request): JsonResponse
    {
        $request->validate([
            'media_id' => 'required|string|exists:media,media_id',
            'backup_disk_id' => 'required|exists:backup_disks,id',
            'backup_path' => 'required|string',
            'checksum' => 'nullable|string',
        ]);

        $user = auth('api')->user();
        $media = Media::where('media_id', $request->media_id)->first();
        $disk = BackupDisk::find($request->backup_disk_id);

        // Check for existing backup
        $existing = Backup::where('media_id', $media->id)
            ->where('backup_disk_id', $disk->id)
            ->first();

        if ($existing) {
            return response()->json([
                'status' => 'exists',
                'message' => 'Backup already exists on this disk',
                'is_verified' => $existing->is_verified,
            ]);
        }

        $backup = Backup::create([
            'media_id' => $media->id,
            'backup_disk_id' => $disk->id,
            'backed_up_by' => $user->id,
            'backup_path' => $request->backup_path,
            'checksum' => $request->checksum,
            'is_verified' => false,
        ]);

        // Update disk usage
        $disk->increment('used_bytes', $media->size_bytes);

        AuditLog::log('backup.create', $user, 'Backup', $backup->id);

        return response()->json([
            'status' => 'backed_up',
            'backup_id' => $backup->id,
            'is_verified' => false,
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'media_id' => 'required|string|exists:media,media_id',
            'backup_disk_id' => 'required|exists:backup_disks,id',
            'checksum' => 'required|string',
        ]);

        $user = auth('api')->user();
        $media = Media::where('media_id', $request->media_id)->first();

        $backup = Backup::where('media_id', $media->id)
            ->where('backup_disk_id', $request->backup_disk_id)
            ->first();

        if (!$backup) {
            return response()->json([
                'status' => 'error',
                'message' => 'Backup not found',
            ], 404);
        }

        // Verify checksum matches
        $isValid = $backup->checksum === $request->checksum || 
                   $media->checksum === $request->checksum;

        if ($isValid) {
            $backup->verify($user);
            $media->update(['status' => 'verified']);

            AuditLog::log('backup.verify', $user, 'Backup', $backup->id);

            return response()->json([
                'status' => 'verified',
                'backup_id' => $backup->id,
            ]);
        }

        return response()->json([
            'status' => 'mismatch',
            'message' => 'Checksum verification failed',
        ], 400);
    }

    public function coverage(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isBackupTeam()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        $totalMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))->count();
        $backedUp = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereHas('backups')
            ->count();
        $verified = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereHas('backups', fn($q) => $q->where('is_verified', true))
            ->count();

        $disks = BackupDisk::withCount([
            'backups',
            'backups as verified_backups' => fn($q) => $q->where('is_verified', true),
        ])->get()->map(fn($d) => [
            'id' => $d->id,
            'name' => $d->name,
            'purpose' => $d->purpose,
            'usage_percentage' => $d->usage_percentage,
            'backups_count' => $d->backups_count,
            'verified_backups' => $d->verified_backups,
            'status' => $d->status,
        ]);

        return response()->json([
            'total_media' => $totalMedia,
            'backed_up' => $backedUp,
            'verified' => $verified,
            'pending' => $totalMedia - $backedUp,
            'unverified' => $backedUp - $verified,
            'coverage_percentage' => $totalMedia > 0 ? round(($verified / $totalMedia) * 100, 2) : 0,
            'disks' => $disks,
        ]);
    }

    public function pending(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isBackupTeam()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $pending = Media::whereDoesntHave('backups', fn($q) => $q->where('is_verified', true))
            ->with(['editor', 'event'])
            ->orderBy('created_at', 'asc')
            ->paginate($request->get('per_page', 50));

        return response()->json($pending);
    }

    public function diskStatus(int $diskId): JsonResponse
    {
        $disk = BackupDisk::withCount([
            'backups',
            'backups as verified_backups' => fn($q) => $q->where('is_verified', true),
        ])->findOrFail($diskId);

        return response()->json([
            'id' => $disk->id,
            'name' => $disk->name,
            'hardware_id' => $disk->hardware_id,
            'purpose' => $disk->purpose,
            'capacity_bytes' => $disk->capacity_bytes,
            'used_bytes' => $disk->used_bytes,
            'available_bytes' => $disk->available_bytes,
            'usage_percentage' => $disk->usage_percentage,
            'backups_count' => $disk->backups_count,
            'verified_backups' => $disk->verified_backups,
            'status' => $disk->status,
            'is_full' => $disk->isFull(),
            'last_used_at' => $disk->last_used_at,
        ]);
    }

    /**
     * Get comprehensive backup analytics for planning
     * Includes event-level, group-level, and individual editor stats
     */
    public function analytics(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isBackupTeam()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Overall stats
        $totalMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))->count();
        $totalSize = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))->sum('size_bytes');
        
        $backedUpMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereHas('backups')
            ->count();
        $backedUpSize = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereHas('backups')
            ->sum('size_bytes');
            
        $verifiedMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereHas('backups', fn($q) => $q->where('is_verified', true))
            ->count();
        $verifiedSize = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereHas('backups', fn($q) => $q->where('is_verified', true))
            ->sum('size_bytes');

        $overallStats = [
            'total_clips' => $totalMedia,
            'total_size_bytes' => $totalSize,
            'total_size_formatted' => $this->formatBytes($totalSize),
            'backed_up_clips' => $backedUpMedia,
            'backed_up_size_bytes' => $backedUpSize,
            'backed_up_size_formatted' => $this->formatBytes($backedUpSize),
            'verified_clips' => $verifiedMedia,
            'verified_size_bytes' => $verifiedSize,
            'verified_size_formatted' => $this->formatBytes($verifiedSize),
            'pending_clips' => $totalMedia - $backedUpMedia,
            'pending_size_bytes' => $totalSize - $backedUpSize,
            'pending_size_formatted' => $this->formatBytes($totalSize - $backedUpSize),
            'backup_percentage' => $totalMedia > 0 ? round(($backedUpMedia / $totalMedia) * 100, 1) : 0,
            'verification_percentage' => $totalMedia > 0 ? round(($verifiedMedia / $totalMedia) * 100, 1) : 0,
        ];

        // Group-level stats
        $groupStats = \App\Models\Group::with(['members'])
            ->get()
            ->map(function ($group) use ($eventId) {
                $memberIds = $group->members->pluck('id')->toArray();
                
                $groupTotal = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->count();
                $groupSize = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->sum('size_bytes');
                $groupBackedUp = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereHas('backups')
                    ->count();
                $groupVerified = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereHas('backups', fn($q) => $q->where('is_verified', true))
                    ->count();

                return [
                    'id' => $group->id,
                    'group_code' => $group->group_code,
                    'name' => $group->name,
                    'member_count' => count($memberIds),
                    'total_clips' => $groupTotal,
                    'total_size_bytes' => $groupSize,
                    'total_size_formatted' => $this->formatBytes($groupSize),
                    'backed_up_clips' => $groupBackedUp,
                    'verified_clips' => $groupVerified,
                    'pending_clips' => $groupTotal - $groupBackedUp,
                    'backup_percentage' => $groupTotal > 0 ? round(($groupBackedUp / $groupTotal) * 100, 1) : 0,
                    'verification_percentage' => $groupTotal > 0 ? round(($groupVerified / $groupTotal) * 100, 1) : 0,
                ];
            })
            ->filter(fn($g) => $g['total_clips'] > 0)
            ->sortByDesc('total_clips')
            ->values();

        // Individual editor stats (top performers and those needing attention)
        $editorStats = \App\Models\User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))
            ->with('groups')
            ->get()
            ->map(function ($editor) use ($eventId) {
                $editorTotal = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->count();
                $editorSize = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->sum('size_bytes');
                $editorBackedUp = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereHas('backups')
                    ->count();
                $editorVerified = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereHas('backups', fn($q) => $q->where('is_verified', true))
                    ->count();

                return [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'email' => $editor->email,
                    'groups' => $editor->groups->map(fn($g) => [
                        'id' => $g->id,
                        'group_code' => $g->group_code,
                    ]),
                    'total_clips' => $editorTotal,
                    'total_size_bytes' => $editorSize,
                    'total_size_formatted' => $this->formatBytes($editorSize),
                    'backed_up_clips' => $editorBackedUp,
                    'verified_clips' => $editorVerified,
                    'pending_clips' => $editorTotal - $editorBackedUp,
                    'backup_percentage' => $editorTotal > 0 ? round(($editorBackedUp / $editorTotal) * 100, 1) : 0,
                    'verification_percentage' => $editorTotal > 0 ? round(($editorVerified / $editorTotal) * 100, 1) : 0,
                ];
            })
            ->filter(fn($e) => $e['total_clips'] > 0)
            ->sortByDesc('total_clips')
            ->values();

        // Backup rate over time (last 7 days)
        $dailyStats = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $dayStart = now()->subDays($i)->startOfDay();
            $dayEnd = now()->subDays($i)->endOfDay();

            $dayTotal = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                ->whereBetween('created_at', [$dayStart, $dayEnd])
                ->count();
            $dayBackedUp = Backup::whereHas('media', function ($q) use ($eventId, $dayStart, $dayEnd) {
                $q->when($eventId, fn($q2) => $q2->where('event_id', $eventId))
                    ->whereBetween('created_at', [$dayStart, $dayEnd]);
            })->count();

            $dailyStats[] = [
                'date' => $date,
                'day' => now()->subDays($i)->format('D'),
                'clips_created' => $dayTotal,
                'clips_backed_up' => $dayBackedUp,
            ];
        }

        // Disk usage summary
        $diskStats = BackupDisk::withCount([
            'backups',
            'backups as verified_backups' => fn($q) => $q->where('is_verified', true),
        ])->get()->map(fn($d) => [
            'id' => $d->id,
            'name' => $d->name,
            'purpose' => $d->purpose,
            'capacity_bytes' => $d->capacity_bytes,
            'capacity_formatted' => $this->formatBytes($d->capacity_bytes),
            'used_bytes' => $d->used_bytes,
            'used_formatted' => $this->formatBytes($d->used_bytes),
            'available_bytes' => $d->available_bytes,
            'available_formatted' => $this->formatBytes($d->available_bytes),
            'usage_percentage' => $d->usage_percentage,
            'backups_count' => $d->backups_count,
            'verified_backups' => $d->verified_backups,
            'status' => $d->status,
        ]);

        return response()->json([
            'overall' => $overallStats,
            'by_group' => $groupStats,
            'by_editor' => $editorStats,
            'daily_trend' => $dailyStats,
            'disks' => $diskStats,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Get pending (not backed up) clips by editor with last backup disk
     */
    public function pendingByEditor(Request $request): JsonResponse
    {
        $eventId = $request->input('event_id');

        // Get all editors with pending clips
        $editors = \App\Models\User::whereHas('roles', fn($q) => $q->where('name', 'editor'))
            ->with(['group'])
            ->get()
            ->map(function ($editor) use ($eventId) {
                // Count renamed but not backed up clips
                $pendingQuery = Media::where('editor_id', $editor->id)
                    ->where('status', 'renamed')
                    ->whereDoesntHave('backups')
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId));

                $pendingClips = $pendingQuery->count();
                $pendingSize = $pendingQuery->sum('file_size');

                // Get last backup disk used by this editor
                $lastBackup = Backup::whereHas('media', fn($q) => $q->where('editor_id', $editor->id))
                    ->orderBy('created_at', 'desc')
                    ->with('disk')
                    ->first();

                return [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'group_code' => $editor->group?->group_code ?? 'N/A',
                    'pending_clips' => $pendingClips,
                    'pending_size' => $pendingSize,
                    'pending_size_formatted' => $this->formatBytes($pendingSize),
                    'last_backup_disk' => $lastBackup?->disk?->name,
                    'last_backup_disk_id' => $lastBackup?->backup_disk_id,
                    'last_backup_time' => $lastBackup?->created_at?->diffForHumans(),
                    'last_backup_path' => $lastBackup?->backup_path,
                ];
            })
            ->filter(fn($e) => $e['pending_clips'] > 0)
            ->sortByDesc('pending_clips')
            ->values();

        return response()->json([
            'data' => $editors,
            'total_editors' => $editors->count(),
            'total_pending_clips' => $editors->sum('pending_clips'),
            'total_pending_size' => $this->formatBytes($editors->sum('pending_size')),
        ]);
    }

    /**
     * Get pending (not backed up) clips by group
     */
    public function pendingByGroup(Request $request): JsonResponse
    {
        $eventId = $request->input('event_id');

        $groups = \App\Models\Group::with(['media' => function ($q) use ($eventId) {
            $q->where('status', 'renamed')
                ->when($eventId, fn($q2) => $q2->where('event_id', $eventId));
        }])->get()->map(function ($group) {
            $totalRenamed = $group->media->count();
            $backedUp = $group->media->filter(fn($m) => $m->backups()->exists())->count();
            $pending = $totalRenamed - $backedUp;
            $pendingSize = $group->media->filter(fn($m) => !$m->backups()->exists())->sum('file_size');

            return [
                'id' => $group->id,
                'group_code' => $group->group_code,
                'name' => $group->name,
                'total_renamed' => $totalRenamed,
                'backed_up' => $backedUp,
                'pending_clips' => $pending,
                'pending_size' => $pendingSize,
                'pending_size_formatted' => $this->formatBytes($pendingSize),
            ];
        })->filter(fn($g) => $g['pending_clips'] > 0)
            ->sortByDesc('pending_clips')
            ->values();

        return response()->json([
            'data' => $groups,
            'total_groups' => $groups->count(),
            'total_pending_clips' => $groups->sum('pending_clips'),
            'total_pending_size' => $this->formatBytes($groups->sum('pending_size')),
        ]);
    }

    /**
     * Get editor disk assignments - which disk each editor should use for backup
     */
    public function editorDiskAssignments(Request $request): JsonResponse
    {
        // Get all editors with their last used backup disk
        $assignments = \App\Models\User::whereHas('roles', fn($q) => $q->where('name', 'editor'))
            ->get()
            ->map(function ($editor) {
                $lastBackup = Backup::whereHas('media', fn($q) => $q->where('editor_id', $editor->id))
                    ->orderBy('created_at', 'desc')
                    ->with('disk')
                    ->first();

                // Get the folder path pattern from last backup
                $folderPath = null;
                if ($lastBackup?->backup_path) {
                    $folderPath = dirname($lastBackup->backup_path);
                }

                return [
                    'editor_id' => $editor->id,
                    'editor_name' => $editor->name,
                    'assigned_disk_id' => $lastBackup?->backup_disk_id,
                    'assigned_disk_name' => $lastBackup?->disk?->name,
                    'folder_path' => $folderPath,
                    'last_backup_at' => $lastBackup?->created_at,
                    'total_backups' => Backup::whereHas('media', fn($q) => $q->where('editor_id', $editor->id))->count(),
                ];
            })
            ->sortBy('editor_name')
            ->values();

        return response()->json([
            'data' => $assignments,
            'total_editors' => $assignments->count(),
            'editors_with_disk' => $assignments->filter(fn($a) => $a['assigned_disk_id'])->count(),
            'editors_without_disk' => $assignments->filter(fn($a) => !$a['assigned_disk_id'])->count(),
        ]);
    }

    /**
     * Get team-wide pending backup totals
     */
    public function teamPendingTotal(Request $request): JsonResponse
    {
        $eventId = $request->input('event_id');

        // Total renamed clips not backed up
        $pendingQuery = Media::where('status', 'renamed')
            ->whereDoesntHave('backups')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId));

        $pendingClips = $pendingQuery->count();
        $pendingSize = $pendingQuery->sum('file_size');

        // Total renamed clips
        $totalRenamed = Media::where('status', 'renamed')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->count();

        // Total backed up
        $totalBackedUp = Media::where('status', 'renamed')
            ->whereHas('backups')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->count();

        // Editors with pending
        $editorsWithPending = Media::where('status', 'renamed')
            ->whereDoesntHave('backups')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->distinct('editor_id')
            ->count('editor_id');

        // Groups with pending
        $groupsWithPending = Media::where('status', 'renamed')
            ->whereDoesntHave('backups')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->distinct('group_id')
            ->count('group_id');

        return response()->json([
            'pending_clips' => $pendingClips,
            'pending_size' => $pendingSize,
            'pending_size_formatted' => $this->formatBytes($pendingSize),
            'total_renamed' => $totalRenamed,
            'total_backed_up' => $totalBackedUp,
            'backup_percentage' => $totalRenamed > 0 ? round(($totalBackedUp / $totalRenamed) * 100, 1) : 100,
            'editors_with_pending' => $editorsWithPending,
            'groups_with_pending' => $groupsWithPending,
        ]);
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes($bytes): string
    {
        if ($bytes === null || $bytes == 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        return round($bytes, 2) . ' ' . $units[$i];
    }
}
