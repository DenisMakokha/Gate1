<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\Issue;
use App\Models\AuditLog;
use App\Models\HealingCase;
use App\Models\CameraSession;
use App\Models\Backup;
use App\Models\User;
use App\Models\Group;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class ExportController extends Controller
{
    public function exportMedia(Request $request): Response
    {
        $user = auth('api')->user();
        if (!$user->isAdmin()) {
            abort(403, 'Unauthorized');
        }

        $query = Media::with(['editor', 'group', 'event']);

        if ($request->has('event_id')) {
            $query->where('event_id', $request->event_id);
        }
        if ($request->has('group_id')) {
            $query->where('group_id', $request->group_id);
        }
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $media = $query->orderBy('created_at', 'desc')->get();

        $csv = $this->generateCsv($media, [
            'media_id' => 'Media ID',
            'original_filename' => 'Filename',
            'media_type' => 'Type',
            'file_size' => 'Size (bytes)',
            'duration_seconds' => 'Duration (s)',
            'status' => 'Status',
            'editor.name' => 'Editor',
            'group.group_code' => 'Group',
            'event.event_code' => 'Event',
            'created_at' => 'Created At',
        ]);

        AuditLog::log('media_exported', 'Media', null, null, ['count' => $media->count()]);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="media_export_' . date('Y-m-d') . '.csv"',
        ]);
    }

    public function exportIssues(Request $request): Response
    {
        $user = auth('api')->user();
        if (!$user->isAdmin() && !$user->isQA()) {
            abort(403, 'Unauthorized');
        }

        $query = Issue::with(['reporter', 'assignee', 'group', 'media']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('severity')) {
            $query->where('severity', $request->severity);
        }
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $issues = $query->orderBy('created_at', 'desc')->get();

        $csv = $this->generateCsv($issues, [
            'issue_id' => 'Issue ID',
            'type' => 'Type',
            'severity' => 'Severity',
            'status' => 'Status',
            'description' => 'Description',
            'reporter.name' => 'Reported By',
            'assignee.name' => 'Assigned To',
            'group.group_code' => 'Group',
            'media.media_id' => 'Media ID',
            'created_at' => 'Created At',
            'resolved_at' => 'Resolved At',
        ]);

        AuditLog::log('issues_exported', 'Issue', null, null, ['count' => $issues->count()]);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="issues_export_' . date('Y-m-d') . '.csv"',
        ]);
    }

    public function exportAuditLogs(Request $request): Response
    {
        $user = auth('api')->user();
        if (!$user->isAdmin()) {
            abort(403, 'Unauthorized');
        }

        $query = AuditLog::with('user');

        if ($request->has('action')) {
            $query->where('action', $request->action);
        }
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $logs = $query->orderBy('created_at', 'desc')->limit(10000)->get();

        $csv = $this->generateCsv($logs, [
            'id' => 'ID',
            'action' => 'Action',
            'entity_type' => 'Entity Type',
            'entity_id' => 'Entity ID',
            'user.name' => 'User',
            'ip_address' => 'IP Address',
            'created_at' => 'Timestamp',
        ]);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="audit_logs_export_' . date('Y-m-d') . '.csv"',
        ]);
    }

    public function exportHealingCases(Request $request): Response
    {
        $user = auth('api')->user();
        if (!$user->isAdmin()) {
            abort(403, 'Unauthorized');
        }

        $query = HealingCase::with(['event', 'group']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('event_id')) {
            $query->where('event_id', $request->event_id);
        }

        $cases = $query->orderBy('healing_date', 'desc')->get();

        $csv = $this->generateCsv($cases, [
            'case_id' => 'Case ID',
            'person_name' => 'Person Name',
            'description' => 'Description',
            'healing_date' => 'Healing Date',
            'status' => 'Status',
            'event.event_code' => 'Event',
            'group.group_code' => 'Group',
            'created_at' => 'Created At',
        ]);

        AuditLog::log('healing_cases_exported', 'HealingCase', null, null, ['count' => $cases->count()]);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="healing_cases_export_' . date('Y-m-d') . '.csv"',
        ]);
    }

    private function generateCsv($data, array $columns): string
    {
        $output = fopen('php://temp', 'r+');

        // Header row
        fputcsv($output, array_values($columns));

        // Data rows
        foreach ($data as $row) {
            $csvRow = [];
            foreach (array_keys($columns) as $key) {
                $value = $this->getNestedValue($row, $key);
                $csvRow[] = is_string($value) ? $value : (string) $value;
            }
            fputcsv($output, $csvRow);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }

    private function getNestedValue($object, string $key)
    {
        $keys = explode('.', $key);
        $value = $object;

        foreach ($keys as $k) {
            if (is_array($value)) {
                $value = $value[$k] ?? null;
            } elseif (is_object($value)) {
                $value = $value->{$k} ?? null;
            } else {
                return null;
            }
        }

        return $value;
    }

    /**
     * Generate daily summary report
     */
    public function dailySummary(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->hasOperationalAccess() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $date = $request->get('date', today()->toDateString());
        $eventId = $request->get('event_id');

        // Determine scope
        if ($user->hasOperationalAccess()) {
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id');
            $groupIds = Group::pluck('id');
        } else {
            $groupIds = $user->ledGroups()->pluck('id');
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id');
        }

        // Copy stats
        $copyStats = CameraSession::whereDate('created_at', $date)
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->selectRaw('
                COUNT(*) as sessions,
                SUM(files_detected) as files_detected,
                SUM(files_copied) as files_copied,
                COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_sessions
            ')
            ->first();

        // Media stats
        $mediaStats = Media::whereDate('created_at', $date)
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->selectRaw('
                COUNT(*) as total,
                SUM(size_bytes) as total_bytes,
                COUNT(CASE WHEN parse_status = "valid" THEN 1 END) as valid,
                COUNT(CASE WHEN parse_status = "warning" THEN 1 END) as warnings,
                COUNT(CASE WHEN parse_status = "error" THEN 1 END) as errors
            ')
            ->first();

        // Backup stats
        $backupStats = Backup::whereDate('created_at', $date)
            ->selectRaw('
                COUNT(*) as total,
                COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified,
                SUM(size_bytes) as total_bytes
            ')
            ->first();

        // Issue stats
        $issueStats = Issue::whereDate('created_at', $date)
            ->selectRaw('
                COUNT(*) as reported,
                COUNT(CASE WHEN severity = "critical" THEN 1 END) as critical
            ')
            ->first();

        $resolvedIssues = Issue::whereDate('resolved_at', $date)->count();

        // Editor performance
        $editorPerformance = User::whereIn('id', $editorIds)
            ->get()
            ->map(function ($editor) use ($date, $eventId) {
                $sessions = CameraSession::where('editor_id', $editor->id)
                    ->whereDate('created_at', $date)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->get();

                $media = Media::where('editor_id', $editor->id)
                    ->whereDate('created_at', $date)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->get();

                return [
                    'name' => $editor->name,
                    'sessions_completed' => $sessions->where('status', 'completed')->count(),
                    'files_copied' => $sessions->sum('files_copied'),
                    'media_synced' => $media->count(),
                    'errors' => $media->where('parse_status', 'error')->count(),
                ];
            })
            ->filter(fn($e) => $e['files_copied'] > 0 || $e['media_synced'] > 0)
            ->sortByDesc('files_copied')
            ->values();

        return response()->json([
            'date' => $date,
            'copy_stats' => [
                'sessions' => $copyStats->sessions ?? 0,
                'completed_sessions' => $copyStats->completed_sessions ?? 0,
                'files_detected' => $copyStats->files_detected ?? 0,
                'files_copied' => $copyStats->files_copied ?? 0,
            ],
            'media_stats' => [
                'total' => $mediaStats->total ?? 0,
                'total_size' => $this->formatBytes($mediaStats->total_bytes ?? 0),
                'valid' => $mediaStats->valid ?? 0,
                'warnings' => $mediaStats->warnings ?? 0,
                'errors' => $mediaStats->errors ?? 0,
                'error_rate' => ($mediaStats->total ?? 0) > 0 
                    ? round(((($mediaStats->warnings ?? 0) + ($mediaStats->errors ?? 0)) / $mediaStats->total) * 100, 2) 
                    : 0,
            ],
            'backup_stats' => [
                'total' => $backupStats->total ?? 0,
                'verified' => $backupStats->verified ?? 0,
                'total_size' => $this->formatBytes($backupStats->total_bytes ?? 0),
            ],
            'issue_stats' => [
                'reported' => $issueStats->reported ?? 0,
                'critical' => $issueStats->critical ?? 0,
                'resolved' => $resolvedIssues,
            ],
            'editor_performance' => $editorPerformance,
        ]);
    }

    /**
     * Generate event completion report
     */
    public function eventReport(Request $request, int $eventId): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $event = Event::findOrFail($eventId);

        // Overall stats
        $totalMedia = Media::where('event_id', $eventId)->count();
        $totalSize = Media::where('event_id', $eventId)->sum('size_bytes');
        $backedUpMedia = Media::where('event_id', $eventId)
            ->whereHas('backups', fn($q) => $q->where('is_verified', true))
            ->count();
        $verifiedBackups = Backup::whereHas('media', fn($q) => $q->where('event_id', $eventId))
            ->where('is_verified', true)
            ->count();

        // Sessions
        $sessions = CameraSession::where('event_id', $eventId)->get();
        $completedSessions = $sessions->where('status', 'completed')->count();

        // Issues
        $totalIssues = Issue::whereHas('media', fn($q) => $q->where('event_id', $eventId))->count();
        $resolvedIssues = Issue::whereHas('media', fn($q) => $q->where('event_id', $eventId))
            ->where('status', 'resolved')
            ->count();

        // Quality
        $parseStats = Media::where('event_id', $eventId)
            ->selectRaw('parse_status, COUNT(*) as count')
            ->groupBy('parse_status')
            ->pluck('count', 'parse_status')
            ->toArray();

        // By group
        $groupStats = Group::withCount([
            'media as media_count' => fn($q) => $q->where('event_id', $eventId),
        ])->get()->filter(fn($g) => $g->media_count > 0)->map(fn($g) => [
            'group_code' => $g->group_code,
            'media_count' => $g->media_count,
        ]);

        // By editor
        $editorStats = User::whereHas('media', fn($q) => $q->where('event_id', $eventId))
            ->withCount(['media as media_count' => fn($q) => $q->where('event_id', $eventId)])
            ->get()
            ->map(fn($e) => [
                'name' => $e->name,
                'media_count' => $e->media_count,
            ])
            ->sortByDesc('media_count')
            ->values();

        return response()->json([
            'event' => [
                'id' => $event->id,
                'name' => $event->name,
                'code' => $event->event_code,
                'status' => $event->status,
                'start_date' => $event->start_date,
                'end_date' => $event->end_date,
            ],
            'summary' => [
                'total_media' => $totalMedia,
                'total_size' => $this->formatBytes($totalSize),
                'backed_up_media' => $backedUpMedia,
                'backup_coverage' => $totalMedia > 0 ? round(($backedUpMedia / $totalMedia) * 100, 1) : 0,
                'verified_backups' => $verifiedBackups,
                'total_sessions' => $sessions->count(),
                'completed_sessions' => $completedSessions,
                'total_issues' => $totalIssues,
                'resolved_issues' => $resolvedIssues,
            ],
            'quality' => [
                'valid' => $parseStats['valid'] ?? 0,
                'warnings' => $parseStats['warning'] ?? 0,
                'errors' => $parseStats['error'] ?? 0,
                'error_rate' => $totalMedia > 0 
                    ? round(((($parseStats['warning'] ?? 0) + ($parseStats['error'] ?? 0)) / $totalMedia) * 100, 2) 
                    : 0,
            ],
            'by_group' => $groupStats,
            'by_editor' => $editorStats,
        ]);
    }

    /**
     * Generate editor performance report
     */
    public function editorPerformanceReport(Request $request): Response
    {
        $user = auth('api')->user();
        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            abort(403, 'Unauthorized');
        }

        $eventId = $request->get('event_id');
        $fromDate = $request->get('from_date', now()->subDays(7)->toDateString());
        $toDate = $request->get('to_date', today()->toDateString());

        // Determine scope
        if ($user->isAdmin()) {
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id');
        } else {
            $groupIds = $user->ledGroups()->pluck('id');
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id');
        }

        $editors = User::whereIn('id', $editorIds)->with('groups')->get();

        $data = $editors->map(function ($editor) use ($eventId, $fromDate, $toDate) {
            $sessions = CameraSession::where('editor_id', $editor->id)
                ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                ->whereBetween('created_at', [$fromDate, $toDate . ' 23:59:59'])
                ->get();

            $media = Media::where('editor_id', $editor->id)
                ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                ->whereBetween('created_at', [$fromDate, $toDate . ' 23:59:59'])
                ->get();

            $totalMedia = $media->count();
            $errors = $media->whereIn('parse_status', ['warning', 'error'])->count();

            return [
                'editor_id' => $editor->id,
                'name' => $editor->name,
                'email' => $editor->email,
                'groups' => $editor->groups->pluck('group_code')->implode(', '),
                'sessions_completed' => $sessions->where('status', 'completed')->count(),
                'files_copied' => $sessions->sum('files_copied'),
                'media_synced' => $totalMedia,
                'total_size_bytes' => $media->sum('size_bytes'),
                'errors' => $errors,
                'error_rate' => $totalMedia > 0 ? round(($errors / $totalMedia) * 100, 2) : 0,
            ];
        })->filter(fn($e) => $e['files_copied'] > 0 || $e['media_synced'] > 0);

        $csv = $this->generateCsv($data, [
            'name' => 'Editor Name',
            'email' => 'Email',
            'groups' => 'Groups',
            'sessions_completed' => 'Sessions Completed',
            'files_copied' => 'Files Copied',
            'media_synced' => 'Media Synced',
            'total_size_bytes' => 'Total Size (bytes)',
            'errors' => 'Errors',
            'error_rate' => 'Error Rate (%)',
        ]);

        AuditLog::log('editor_performance_exported', 'Report', null, null, [
            'from_date' => $fromDate,
            'to_date' => $toDate,
        ]);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="editor_performance_' . $fromDate . '_to_' . $toDate . '.csv"',
        ]);
    }

    /**
     * Export backup report
     */
    public function backupReport(Request $request): Response
    {
        $user = auth('api')->user();
        if (!$user->isAdmin() && !$user->isBackup()) {
            abort(403, 'Unauthorized');
        }

        $eventId = $request->get('event_id');

        $backups = Backup::with(['media.editor', 'media.event', 'disk'])
            ->when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
            ->orderByDesc('created_at')
            ->get();

        $csv = $this->generateCsv($backups, [
            'id' => 'Backup ID',
            'media.filename' => 'Filename',
            'media.editor.name' => 'Editor',
            'media.event.name' => 'Event',
            'disk.disk_label' => 'Disk',
            'size_bytes' => 'Size (bytes)',
            'is_verified' => 'Verified',
            'verified_at' => 'Verified At',
            'created_at' => 'Created At',
        ]);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="backup_report_' . date('Y-m-d') . '.csv"',
        ]);
    }

    private function formatBytes($bytes): string
    {
        if ($bytes == 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        return round($bytes, 2) . ' ' . $units[$i];
    }
}
