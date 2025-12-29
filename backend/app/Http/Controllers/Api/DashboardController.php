<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\CameraSession;
use App\Models\Event;
use App\Models\Group;
use App\Models\Issue;
use App\Models\Media;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    private function resolveEventId(Request $request): ?int
    {
        $eventId = $request->get('event_id');
        if ($eventId) {
            return (int) $eventId;
        }

        $active = Event::where('status', 'active')->orderByDesc('start_date')->first();
        return $active?->id;
    }
    public function admin(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Calculate camera health metrics
        $totalCameras = \App\Models\Camera::when($eventId, fn($q) => $q->where('event_id', $eventId))->count();
        $camerasWithIssues = Issue::whereIn('status', ['open', 'acknowledged'])
            ->when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
            ->whereHas('media')
            ->get()
            ->pluck('media.camera_number')
            ->unique()
            ->count();
        $camerasHealthy = max(0, $totalCameras - $camerasWithIssues);
        
        // Count early removals today
        $earlyRemovalsToday = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->where('status', 'early_removal')
            ->whereDate('ended_at', today())->count();
        
        // Calculate backup coverage
        $totalMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))->count();
        $backedUp = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereHas('backups', fn($q) => $q->where('is_verified', true))
            ->count();
        $backupCoverage = $totalMedia > 0 ? round(($backedUp / $totalMedia) * 100) : 0;
        
        return response()->json([
            'overview' => [
                'total_media' => $totalMedia,
                'media_today' => Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereDate('created_at', today())->count(),
                'open_issues' => Issue::whereIn('status', ['open', 'acknowledged', 'in_progress'])
                    ->when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
                    ->count(),
                'critical_issues' => Issue::where('severity', 'critical')
                    ->whereIn('status', ['open', 'acknowledged'])
                    ->when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
                    ->count(),
                'pending_backups' => Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereDoesntHave('backups', fn($q) => $q->where('is_verified', true))
                    ->count(),
                'active_sessions' => CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('status', 'active')
                    ->count(),
                'online_agents' => Agent::where('status', 'active')
                    ->where('last_seen_at', '>', now()->subMinutes(2))->count(),
                'total_editors' => User::whereHas('roles', fn($q) => $q->where('name', 'editor'))->count(),
                'cameras_healthy' => $camerasHealthy,
                'cameras_attention' => $camerasWithIssues,
                'early_removals_today' => $earlyRemovalsToday,
                'backup_coverage' => $backupCoverage,
            ],
            'events' => Event::where('status', 'active')
                ->withCount('media')
                ->get()
                ->map(fn($e) => [
                    'id' => $e->id,
                    'name' => $e->name,
                    'media_count' => $e->media_count,
                ]),
            'groups_health' => Group::when($eventId, fn($q) => $q->where('event_id', $eventId))
                ->withCount([
                'issues as open_issues' => fn($q) => $q->whereIn('status', ['open', 'acknowledged']),
            ])->orderByDesc('open_issues')->limit(10)->get()
                ->map(fn($g) => [
                    'id' => $g->id,
                    'code' => $g->group_code,
                    'name' => $g->name,
                    'open_issues' => $g->open_issues,
                ]),
            'recent_issues' => Issue::with(['media', 'reporter'])
                ->when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
                ->whereIn('status', ['open', 'acknowledged'])
                ->orderByDesc('created_at')
                ->limit(10)
                ->get()
                ->map(fn($i) => [
                    'id' => $i->issue_id,
                    'type' => $i->type,
                    'severity' => $i->severity,
                    'reporter' => $i->reporter->name,
                    'created_at' => $i->created_at,
                ]),
        ]);
    }

    public function groupLeader(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isGroupLeader() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $groupIds = $user->isAdmin() 
            ? Group::pluck('id') 
            : $user->ledGroups()->pluck('id');

        $groups = Group::whereIn('id', $groupIds)
            ->with(['members'])
            ->withCount([
                'issues as open_issues' => fn($q) => $q->whereIn('status', ['open', 'acknowledged']),
                'issues as resolved_today' => fn($q) => $q->where('status', 'resolved')
                    ->whereDate('resolved_at', today()),
            ])
            ->get();

        $memberIds = $groups->flatMap(fn($g) => $g->members->pluck('id'));

        return response()->json([
            'groups' => $groups->map(fn($g) => [
                'id' => $g->id,
                'code' => $g->group_code,
                'name' => $g->name,
                'member_count' => $g->members->count(),
                'open_issues' => $g->open_issues,
                'resolved_today' => $g->resolved_today,
            ]),
            'team_stats' => [
                'total_members' => $memberIds->unique()->count(),
                'online_members' => Agent::whereIn('user_id', $memberIds)
                    ->where('status', 'active')
                    ->where('last_seen_at', '>', now()->subMinutes(2))
                    ->count(),
                'media_today' => Media::whereIn('editor_id', $memberIds)
                    ->whereDate('created_at', today())
                    ->count(),
            ],
            'recent_issues' => Issue::whereIn('group_id', $groupIds)
                ->with(['media', 'reporter'])
                ->whereIn('status', ['open', 'acknowledged'])
                ->orderByDesc('created_at')
                ->limit(10)
                ->get(),
        ]);
    }

    public function qa(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isQA() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json([
            'issue_summary' => [
                'open' => Issue::where('status', 'open')->count(),
                'acknowledged' => Issue::where('status', 'acknowledged')->count(),
                'in_progress' => Issue::where('status', 'in_progress')->count(),
                'escalated' => Issue::where('status', 'escalated')->count(),
                'resolved_today' => Issue::where('status', 'resolved')
                    ->whereDate('resolved_at', today())->count(),
            ],
            'by_type' => Issue::whereIn('status', ['open', 'acknowledged', 'in_progress'])
                ->selectRaw('type, count(*) as count')
                ->groupBy('type')
                ->pluck('count', 'type'),
            'by_severity' => Issue::whereIn('status', ['open', 'acknowledged', 'in_progress'])
                ->selectRaw('severity, count(*) as count')
                ->groupBy('severity')
                ->pluck('count', 'severity'),
            'critical_issues' => Issue::where('severity', 'critical')
                ->whereIn('status', ['open', 'acknowledged', 'escalated'])
                ->with(['media', 'reporter', 'group'])
                ->orderByDesc('created_at')
                ->limit(20)
                ->get(),
        ]);
    }

    public function backup(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isBackupTeam() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $totalMedia = Media::count();
        $backedUp = Media::whereHas('backups')->count();
        $verified = Media::whereHas('backups', fn($q) => $q->where('is_verified', true))->count();

        return response()->json([
            'coverage' => [
                'total_media' => $totalMedia,
                'backed_up' => $backedUp,
                'verified' => $verified,
                'pending' => $totalMedia - $backedUp,
                'unverified' => $backedUp - $verified,
                'coverage_percentage' => $totalMedia > 0 ? round(($verified / $totalMedia) * 100, 2) : 0,
            ],
            'by_editor' => Media::whereDoesntHave('backups', fn($q) => $q->where('is_verified', true))
                ->selectRaw('editor_id, count(*) as pending_count')
                ->groupBy('editor_id')
                ->with('editor:id,name')
                ->orderByDesc('pending_count')
                ->limit(20)
                ->get(),
            'recent_backups' => Backup::with(['media', 'backedUpBy'])
                ->where('is_verified', true)
                ->orderByDesc('verified_at')
                ->limit(20)
                ->get(),
        ]);
    }

    public function editor(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        return response()->json([
            'today' => [
                'files_indexed' => Media::where('editor_id', $user->id)
                    ->whereDate('created_at', today())->count(),
                'issues_reported' => Issue::where('reported_by', $user->id)
                    ->whereDate('created_at', today())->count(),
                'backups_verified' => Backup::where('backed_up_by', $user->id)
                    ->where('is_verified', true)
                    ->whereDate('verified_at', today())->count(),
            ],
            'active_sessions' => CameraSession::where('editor_id', $user->id)
                ->where('status', 'active')
                ->with('sdCard')
                ->get()
                ->map(fn($s) => [
                    'session_id' => $s->session_id,
                    'camera_number' => $s->camera_number,
                    'sd_label' => $s->sdCard->sd_label,
                    'files_detected' => $s->files_detected,
                    'files_copied' => $s->files_copied,
                    'copy_progress' => $s->copy_progress,
                ]),
            'my_issues' => Issue::where('reported_by', $user->id)
                ->whereIn('status', ['open', 'acknowledged'])
                ->with('media')
                ->orderByDesc('created_at')
                ->limit(10)
                ->get(),
            'pending_backups' => Media::where('editor_id', $user->id)
                ->whereDoesntHave('backups', fn($q) => $q->where('is_verified', true))
                ->count(),
        ]);
    }

    public function analyticsOverview(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $today = now()->startOfDay();
        $thisWeek = now()->startOfWeek();
        $thisMonth = now()->startOfMonth();
        $lastMonth = now()->subMonth()->startOfMonth();

        return response()->json([
            'media' => [
                'total' => Media::count(),
                'today' => Media::where('created_at', '>=', $today)->count(),
                'this_week' => Media::where('created_at', '>=', $thisWeek)->count(),
                'this_month' => Media::where('created_at', '>=', $thisMonth)->count(),
                'last_month' => Media::whereBetween('created_at', [$lastMonth, $thisMonth])->count(),
                'growth' => $this->calculateGrowth(
                    Media::whereBetween('created_at', [$lastMonth, $thisMonth])->count(),
                    Media::where('created_at', '>=', $thisMonth)->count()
                ),
            ],
            'issues' => [
                'total' => Issue::count(),
                'open' => Issue::whereIn('status', ['open', 'acknowledged', 'in_progress'])->count(),
                'resolved_today' => Issue::where('status', 'resolved')->where('resolved_at', '>=', $today)->count(),
                'resolved_this_week' => Issue::where('status', 'resolved')->where('resolved_at', '>=', $thisWeek)->count(),
                'avg_resolution_time' => Issue::where('status', 'resolved')
                    ->whereNotNull('resolved_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours')
                    ->value('avg_hours') ?? 0,
            ],
            'users' => [
                'total' => \App\Models\User::count(),
                'active' => \App\Models\User::where('is_active', true)->count(),
                'pending_approval' => \App\Models\User::where('approval_status', 'pending')->count(),
                'online_agents' => Agent::where('status', 'active')
                    ->where('last_seen_at', '>', now()->subMinutes(5))->count(),
            ],
            'backups' => [
                'total_media' => Media::count(),
                'backed_up' => Media::whereHas('backups', fn($q) => $q->where('is_verified', true))->count(),
                'coverage_percent' => Media::count() > 0 
                    ? round((Media::whereHas('backups', fn($q) => $q->where('is_verified', true))->count() / Media::count()) * 100, 1)
                    : 0,
            ],
            'events' => [
                'total' => Event::count(),
                'active' => Event::where('status', 'active')->count(),
            ],
            'groups' => [
                'total' => Group::count(),
                'with_issues' => Group::whereHas('issues', fn($q) => $q->whereIn('status', ['open', 'acknowledged']))->count(),
            ],
        ]);
    }

    public function mediaTrends(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $days = $request->get('days', 30);
        $startDate = now()->subDays($days)->startOfDay();

        // Daily media count
        $dailyMedia = Media::where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        // Fill in missing dates
        $trends = [];
        for ($i = $days; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $trends[] = [
                'date' => $date,
                'count' => $dailyMedia[$date]->count ?? 0,
            ];
        }

        // By editor (top 10)
        $byEditor = Media::where('created_at', '>=', $startDate)
            ->selectRaw('editor_id, COUNT(*) as count')
            ->groupBy('editor_id')
            ->with('editor:id,name')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        // By event
        $byEvent = Media::where('created_at', '>=', $startDate)
            ->selectRaw('event_id, COUNT(*) as count')
            ->groupBy('event_id')
            ->with('event:id,name')
            ->orderByDesc('count')
            ->get();

        return response()->json([
            'daily' => $trends,
            'by_editor' => $byEditor,
            'by_event' => $byEvent,
            'total' => Media::where('created_at', '>=', $startDate)->count(),
        ]);
    }

    public function issuesTrends(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $days = $request->get('days', 30);
        $startDate = now()->subDays($days)->startOfDay();

        // Daily issues created vs resolved
        $dailyCreated = Issue::where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->get()
            ->keyBy('date');

        $dailyResolved = Issue::where('resolved_at', '>=', $startDate)
            ->selectRaw('DATE(resolved_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->get()
            ->keyBy('date');

        $trends = [];
        for ($i = $days; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $trends[] = [
                'date' => $date,
                'created' => $dailyCreated[$date]->count ?? 0,
                'resolved' => $dailyResolved[$date]->count ?? 0,
            ];
        }

        // By type
        $byType = Issue::where('created_at', '>=', $startDate)
            ->selectRaw('type, COUNT(*) as count')
            ->groupBy('type')
            ->orderByDesc('count')
            ->get();

        // By severity
        $bySeverity = Issue::where('created_at', '>=', $startDate)
            ->selectRaw('severity, COUNT(*) as count')
            ->groupBy('severity')
            ->get();

        // By group (top 10)
        $byGroup = Issue::where('created_at', '>=', $startDate)
            ->selectRaw('group_id, COUNT(*) as count')
            ->groupBy('group_id')
            ->with('group:id,group_code,name')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        return response()->json([
            'daily' => $trends,
            'by_type' => $byType,
            'by_severity' => $bySeverity,
            'by_group' => $byGroup,
            'total_created' => Issue::where('created_at', '>=', $startDate)->count(),
            'total_resolved' => Issue::where('resolved_at', '>=', $startDate)->count(),
        ]);
    }

    public function userActivity(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $days = $request->get('days', 7);
        $startDate = now()->subDays($days)->startOfDay();

        // Active users by day
        $dailyActive = AuditLog::where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, COUNT(DISTINCT user_id) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Top active users
        $topUsers = AuditLog::where('created_at', '>=', $startDate)
            ->selectRaw('user_id, COUNT(*) as action_count')
            ->groupBy('user_id')
            ->with('user:id,name,email')
            ->orderByDesc('action_count')
            ->limit(10)
            ->get();

        // Activity by action type
        $byAction = AuditLog::where('created_at', '>=', $startDate)
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->orderByDesc('count')
            ->limit(15)
            ->get();

        // Login activity
        $loginActivity = AuditLog::where('action', 'user.login')
            ->where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'daily_active_users' => $dailyActive,
            'top_users' => $topUsers,
            'by_action' => $byAction,
            'login_activity' => $loginActivity,
        ]);
    }

    protected function calculateGrowth($previous, $current): float
    {
        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }
        return round((($current - $previous) / $previous) * 100, 1);
    }

    /**
     * Get workflow progress analytics (copy/rename progress)
     * Accessible by admin and group leaders
     */
    public function workflowProgress(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Determine which groups/editors to include
        if ($user->hasOperationalAccess()) {
            $groupIds = Group::pluck('id')->toArray();
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id')->toArray();
        } else {
            $groupIds = $user->ledGroups()->pluck('id')->toArray();
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id')->toArray();
        }

        // Overall session/copy stats from CameraSessions
        $totalFilesDetected = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->sum('files_detected');
        $totalFilesCopied = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->sum('files_copied');
        $totalFilesPending = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->sum('files_pending');

        // Media stats (renamed = synced status means file was copied & renamed properly)
        $totalMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->count();
        $renamedMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->whereIn('status', ['synced', 'backed_up', 'verified'])
            ->count();
        $totalSizeBytes = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->sum('size_bytes');

        // Active sessions
        $activeSessions = CameraSession::where('status', 'active')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->count();

        $overallStats = [
            'files_detected' => $totalFilesDetected,
            'files_copied' => $totalFilesCopied,
            'files_pending' => $totalFilesPending,
            'copy_percentage' => $totalFilesDetected > 0 ? round(($totalFilesCopied / $totalFilesDetected) * 100, 1) : 0,
            'total_media' => $totalMedia,
            'renamed_media' => $renamedMedia,
            'rename_percentage' => $totalMedia > 0 ? round(($renamedMedia / $totalMedia) * 100, 1) : 100,
            'total_size_bytes' => $totalSizeBytes,
            'total_size_formatted' => $this->formatBytes($totalSizeBytes),
            'active_sessions' => $activeSessions,
        ];

        // Group-level stats
        $groupStats = Group::whereIn('id', $groupIds)
            ->with(['members'])
            ->get()
            ->map(function ($group) use ($eventId) {
                $memberIds = $group->members->pluck('id')->toArray();

                $filesDetected = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereIn('editor_id', $memberIds)
                    ->sum('files_detected');
                $filesCopied = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereIn('editor_id', $memberIds)
                    ->sum('files_copied');
                $filesPending = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereIn('editor_id', $memberIds)
                    ->sum('files_pending');

                $totalMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereIn('editor_id', $memberIds)
                    ->count();
                $renamedMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereIn('editor_id', $memberIds)
                    ->whereIn('status', ['synced', 'backed_up', 'verified'])
                    ->count();
                $totalSize = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereIn('editor_id', $memberIds)
                    ->sum('size_bytes');

                $activeSessions = CameraSession::where('status', 'active')
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereIn('editor_id', $memberIds)
                    ->count();

                return [
                    'id' => $group->id,
                    'group_code' => $group->group_code,
                    'name' => $group->name,
                    'member_count' => count($memberIds),
                    'files_detected' => $filesDetected,
                    'files_copied' => $filesCopied,
                    'files_pending' => $filesPending,
                    'copy_percentage' => $filesDetected > 0 ? round(($filesCopied / $filesDetected) * 100, 1) : 0,
                    'total_media' => $totalMedia,
                    'renamed_media' => $renamedMedia,
                    'rename_percentage' => $totalMedia > 0 ? round(($renamedMedia / $totalMedia) * 100, 1) : 100,
                    'total_size_bytes' => $totalSize,
                    'total_size_formatted' => $this->formatBytes($totalSize),
                    'active_sessions' => $activeSessions,
                ];
            })
            ->filter(fn($g) => $g['files_detected'] > 0 || $g['total_media'] > 0)
            ->sortByDesc('total_media')
            ->values();

        // Editor-level stats
        $editorStats = User::whereIn('id', $editorIds)
            ->with('groups')
            ->get()
            ->map(function ($editor) use ($eventId) {
                $filesDetected = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('editor_id', $editor->id)
                    ->sum('files_detected');
                $filesCopied = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('editor_id', $editor->id)
                    ->sum('files_copied');
                $filesPending = CameraSession::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('editor_id', $editor->id)
                    ->sum('files_pending');

                $totalMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('editor_id', $editor->id)
                    ->count();
                $renamedMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('editor_id', $editor->id)
                    ->whereIn('status', ['synced', 'backed_up', 'verified'])
                    ->count();
                $totalSize = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('editor_id', $editor->id)
                    ->sum('size_bytes');

                $activeSessions = CameraSession::where('status', 'active')
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('editor_id', $editor->id)
                    ->count();

                // Online status
                $isOnline = $editor->is_online && 
                    $editor->last_seen_at && 
                    $editor->last_seen_at->gte(now()->subMinutes(5));

                return [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'email' => $editor->email,
                    'is_online' => $isOnline,
                    'groups' => $editor->groups->map(fn($g) => [
                        'id' => $g->id,
                        'group_code' => $g->group_code,
                    ]),
                    'files_detected' => $filesDetected,
                    'files_copied' => $filesCopied,
                    'files_pending' => $filesPending,
                    'copy_percentage' => $filesDetected > 0 ? round(($filesCopied / $filesDetected) * 100, 1) : 0,
                    'total_media' => $totalMedia,
                    'renamed_media' => $renamedMedia,
                    'rename_percentage' => $totalMedia > 0 ? round(($renamedMedia / $totalMedia) * 100, 1) : 100,
                    'total_size_bytes' => $totalSize,
                    'total_size_formatted' => $this->formatBytes($totalSize),
                    'active_sessions' => $activeSessions,
                ];
            })
            ->filter(fn($e) => $e['files_detected'] > 0 || $e['total_media'] > 0)
            ->sortByDesc('total_media')
            ->values();

        // Active sessions detail
        $activeSessionsList = CameraSession::where('status', 'active')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->with(['editor', 'sdCard', 'event'])
            ->orderByDesc('started_at')
            ->limit(20)
            ->get()
            ->map(fn($s) => [
                'session_id' => $s->session_id,
                'editor' => $s->editor->name,
                'sd_label' => $s->sdCard?->sd_label,
                'camera_number' => $s->camera_number,
                'files_detected' => $s->files_detected,
                'files_copied' => $s->files_copied,
                'files_pending' => $s->files_pending,
                'copy_progress' => $s->copy_progress,
                'started_at' => $s->started_at,
            ]);

        return response()->json([
            'overall' => $overallStats,
            'by_group' => $groupStats,
            'by_editor' => $editorStats,
            'active_sessions' => $activeSessionsList,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Time-Based Analytics - Processing speed, efficiency, bottlenecks
     */
    public function timeAnalytics(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Determine scope based on user role
        if ($user->hasOperationalAccess()) {
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id')->toArray();
        } else {
            $groupIds = $user->ledGroups()->pluck('id')->toArray();
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id')->toArray();
        }

        // Average session duration
        $completedSessions = CameraSession::where('status', 'completed')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->whereNotNull('ended_at')
            ->get();

        $avgSessionMinutes = $completedSessions->count() > 0
            ? $completedSessions->avg(fn($s) => $s->started_at->diffInMinutes($s->ended_at))
            : 0;

        // Average files per session
        $avgFilesPerSession = $completedSessions->avg('files_detected') ?? 0;

        // Files processed per hour (last 24 hours)
        $last24Hours = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->where('created_at', '>=', now()->subHours(24))
            ->count();
        $filesPerHour = round($last24Hours / 24, 1);

        // Editor efficiency (files per hour per editor)
        $editorEfficiency = User::whereIn('id', $editorIds)
            ->get()
            ->map(function ($editor) use ($eventId) {
                $filesLast8Hours = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('created_at', '>=', now()->subHours(8))
                    ->count();
                
                $sessionsLast8Hours = CameraSession::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('created_at', '>=', now()->subHours(8))
                    ->count();

                return [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'files_last_8h' => $filesLast8Hours,
                    'sessions_last_8h' => $sessionsLast8Hours,
                    'files_per_hour' => round($filesLast8Hours / 8, 1),
                    'is_online' => $editor->is_online && $editor->last_seen_at?->gte(now()->subMinutes(5)),
                ];
            })
            ->sortByDesc('files_per_hour')
            ->values();

        // Hourly breakdown (last 12 hours)
        $hourlyBreakdown = [];
        for ($i = 11; $i >= 0; $i--) {
            $hourStart = now()->subHours($i)->startOfHour();
            $hourEnd = now()->subHours($i)->endOfHour();
            
            $filesCount = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                ->whereIn('editor_id', $editorIds)
                ->whereBetween('created_at', [$hourStart, $hourEnd])
                ->count();

            $hourlyBreakdown[] = [
                'hour' => $hourStart->format('H:i'),
                'files' => $filesCount,
            ];
        }

        // Peak hours analysis (which hours have most activity)
        $peakHours = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->where('created_at', '>=', now()->subDays(7))
            ->selectRaw('HOUR(created_at) as hour, COUNT(*) as count')
            ->groupBy('hour')
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(fn($r) => [
                'hour' => sprintf('%02d:00', $r->hour),
                'avg_files' => round($r->count / 7, 1),
            ]);

        // Bottleneck detection - sessions with slow progress
        $slowSessions = CameraSession::where('status', 'active')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->where('started_at', '<', now()->subMinutes(30))
            ->whereColumn('files_copied', '<', 'files_detected')
            ->with(['editor', 'sdCard'])
            ->get()
            ->map(fn($s) => [
                'session_id' => $s->session_id,
                'editor' => $s->editor->name,
                'camera' => $s->camera_number,
                'files_detected' => $s->files_detected,
                'files_copied' => $s->files_copied,
                'progress' => $s->copy_progress,
                'duration_minutes' => $s->started_at->diffInMinutes(now()),
                'status' => $s->copy_progress < 50 ? 'critical' : 'warning',
            ]);

        return response()->json([
            'summary' => [
                'avg_session_minutes' => round($avgSessionMinutes, 1),
                'avg_files_per_session' => round($avgFilesPerSession, 1),
                'files_per_hour_24h' => $filesPerHour,
                'total_files_24h' => $last24Hours,
            ],
            'editor_efficiency' => $editorEfficiency,
            'hourly_breakdown' => $hourlyBreakdown,
            'peak_hours' => $peakHours,
            'bottlenecks' => $slowSessions,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Incident Dashboard - Deletions, violations, policy breaches
     */
    public function incidents(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');
        $days = $request->get('days', 7);

        // Determine scope
        if ($user->isAdmin()) {
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id')->toArray();
        } else {
            $groupIds = $user->ledGroups()->pluck('id')->toArray();
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id')->toArray();
        }

        // File deletions (from audit log)
        $deletions = AuditLog::where('action', 'like', '%delete%')
            ->where('created_at', '>=', now()->subDays($days))
            ->whereIn('user_id', $editorIds)
            ->with('user')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn($log) => [
                'id' => $log->id,
                'user' => $log->user?->name ?? 'Unknown',
                'user_id' => $log->user_id,
                'action' => $log->action,
                'details' => $log->details,
                'created_at' => $log->created_at->toIso8601String(),
                'severity' => 'critical',
            ]);

        // Early SD removals
        $earlyRemovals = CameraSession::where('removal_decision', 'early_confirmed')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->where('ended_at', '>=', now()->subDays($days))
            ->with(['editor', 'event'])
            ->orderByDesc('ended_at')
            ->limit(50)
            ->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'session_id' => $s->session_id,
                'user' => $s->editor->name,
                'user_id' => $s->editor_id,
                'event' => $s->event?->name,
                'camera' => $s->camera_number,
                'files_pending' => $s->files_pending,
                'created_at' => $s->ended_at->toIso8601String(),
                'severity' => $s->files_pending > 10 ? 'critical' : 'warning',
            ]);

        // Filename issues
        $filenameIssues = Issue::where('type', 'filename_error')
            ->when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
            ->whereHas('reporter', fn($q) => $q->whereIn('id', $editorIds))
            ->where('created_at', '>=', now()->subDays($days))
            ->with(['reporter', 'media'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn($i) => [
                'id' => $i->id,
                'issue_id' => $i->issue_id,
                'user' => $i->reporter?->name,
                'user_id' => $i->reported_by,
                'filename' => $i->media?->filename,
                'description' => $i->description,
                'status' => $i->status,
                'created_at' => $i->created_at->toIso8601String(),
                'severity' => 'low',
            ]);

        // Repeat offenders (users with multiple incidents)
        $allIncidentUserIds = collect()
            ->merge($deletions->pluck('user_id'))
            ->merge($earlyRemovals->pluck('user_id'))
            ->countBy()
            ->filter(fn($count) => $count >= 2)
            ->keys();

        $repeatOffenders = User::whereIn('id', $allIncidentUserIds)
            ->get()
            ->map(function ($user) use ($deletions, $earlyRemovals, $filenameIssues) {
                $userDeletions = $deletions->where('user_id', $user->id)->count();
                $userEarlyRemovals = $earlyRemovals->where('user_id', $user->id)->count();
                $userFilenameIssues = $filenameIssues->where('user_id', $user->id)->count();
                
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'deletions' => $userDeletions,
                    'early_removals' => $userEarlyRemovals,
                    'filename_issues' => $userFilenameIssues,
                    'total_incidents' => $userDeletions + $userEarlyRemovals + $userFilenameIssues,
                ];
            })
            ->sortByDesc('total_incidents')
            ->values();

        // Summary counts
        $summary = [
            'total_incidents' => $deletions->count() + $earlyRemovals->count() + $filenameIssues->count(),
            'deletions' => $deletions->count(),
            'early_removals' => $earlyRemovals->count(),
            'filename_issues' => $filenameIssues->count(),
            'critical_count' => $deletions->count() + $earlyRemovals->where('severity', 'critical')->count(),
            'repeat_offenders' => $repeatOffenders->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'deletions' => $deletions,
            'early_removals' => $earlyRemovals,
            'filename_issues' => $filenameIssues,
            'repeat_offenders' => $repeatOffenders,
            'period_days' => $days,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * SD Card Lifecycle - Usage, health, turnaround
     */
    public function sdCardLifecycle(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // All SD cards with usage stats
        $sdCards = \App\Models\SdCard::withCount([
            'sessions',
            'sessions as active_sessions_count' => fn($q) => $q->where('status', 'active'),
            'sessions as completed_sessions_count' => fn($q) => $q->where('status', 'completed'),
            'sessions as early_removal_count' => fn($q) => $q->where('removal_decision', 'early_confirmed'),
        ])
        ->with(['sessions' => fn($q) => $q->latest()->limit(1)])
        ->get()
        ->map(function ($sd) {
            $lastSession = $sd->sessions->first();
            $avgSessionDuration = CameraSession::where('sd_card_id', $sd->id)
                ->where('status', 'completed')
                ->whereNotNull('ended_at')
                ->get()
                ->avg(fn($s) => $s->started_at->diffInMinutes($s->ended_at));

            $totalFilesProcessed = CameraSession::where('sd_card_id', $sd->id)
                ->sum('files_copied');

            return [
                'id' => $sd->id,
                'hardware_id' => $sd->hardware_id,
                'camera_number' => $sd->camera_number,
                'sd_label' => $sd->sd_label,
                'total_sessions' => $sd->sessions_count,
                'completed_sessions' => $sd->completed_sessions_count,
                'active_sessions' => $sd->active_sessions_count,
                'early_removals' => $sd->early_removal_count,
                'reliability_score' => $sd->sessions_count > 0 
                    ? round((1 - ($sd->early_removal_count / $sd->sessions_count)) * 100, 1) 
                    : 100,
                'total_files_processed' => $totalFilesProcessed,
                'avg_session_minutes' => round($avgSessionDuration ?? 0, 1),
                'last_used' => $lastSession?->started_at?->toIso8601String(),
                'status' => $sd->active_sessions_count > 0 ? 'in_use' : 'available',
            ];
        })
        ->sortByDesc('total_sessions')
        ->values();

        // Cards with issues (high early removal rate)
        $problematicCards = $sdCards->filter(fn($sd) => $sd['reliability_score'] < 80 && $sd['total_sessions'] >= 3);

        // Currently in use
        $inUseCards = $sdCards->where('status', 'in_use');

        // Summary
        $summary = [
            'total_cards' => $sdCards->count(),
            'in_use' => $inUseCards->count(),
            'available' => $sdCards->where('status', 'available')->count(),
            'problematic' => $problematicCards->count(),
            'total_sessions_all_time' => $sdCards->sum('total_sessions'),
            'avg_reliability' => round($sdCards->avg('reliability_score'), 1),
        ];

        return response()->json([
            'summary' => $summary,
            'cards' => $sdCards,
            'problematic_cards' => $problematicCards->values(),
            'in_use' => $inUseCards->values(),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Comparative Analytics - Leaderboard, comparisons
     */
    public function comparativeAnalytics(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Determine scope
        if ($user->isAdmin()) {
            $groupIds = Group::pluck('id')->toArray();
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id')->toArray();
        } else {
            $groupIds = $user->ledGroups()->pluck('id')->toArray();
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id')->toArray();
        }

        // Editor Leaderboard (by files processed today)
        $editorLeaderboard = User::whereIn('id', $editorIds)
            ->get()
            ->map(function ($editor) use ($eventId) {
                $filesToday = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereDate('created_at', today())
                    ->count();
                $filesYesterday = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereDate('created_at', today()->subDay())
                    ->count();
                $filesThisWeek = Media::where('editor_id', $editor->id)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('created_at', '>=', now()->startOfWeek())
                    ->count();

                return [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'files_today' => $filesToday,
                    'files_yesterday' => $filesYesterday,
                    'files_this_week' => $filesThisWeek,
                    'trend' => $filesToday > $filesYesterday ? 'up' : ($filesToday < $filesYesterday ? 'down' : 'same'),
                    'change_percent' => $filesYesterday > 0 
                        ? round((($filesToday - $filesYesterday) / $filesYesterday) * 100, 1) 
                        : 0,
                ];
            })
            ->sortByDesc('files_today')
            ->values()
            ->take(20);

        // Group Comparison
        $groupComparison = Group::whereIn('id', $groupIds)
            ->with('members')
            ->get()
            ->map(function ($group) use ($eventId) {
                $memberIds = $group->members->pluck('id')->toArray();
                
                $filesToday = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereDate('created_at', today())
                    ->count();
                $filesYesterday = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereDate('created_at', today()->subDay())
                    ->count();
                $filesThisWeek = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->where('created_at', '>=', now()->startOfWeek())
                    ->count();

                $backupsComplete = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereHas('backups', fn($q) => $q->where('is_verified', true))
                    ->count();
                $totalMedia = Media::whereIn('editor_id', $memberIds)
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->count();

                return [
                    'id' => $group->id,
                    'group_code' => $group->group_code,
                    'name' => $group->name,
                    'member_count' => count($memberIds),
                    'files_today' => $filesToday,
                    'files_yesterday' => $filesYesterday,
                    'files_this_week' => $filesThisWeek,
                    'backup_percentage' => $totalMedia > 0 ? round(($backupsComplete / $totalMedia) * 100, 1) : 0,
                    'trend' => $filesToday > $filesYesterday ? 'up' : ($filesToday < $filesYesterday ? 'down' : 'same'),
                ];
            })
            ->sortByDesc('files_today')
            ->values();

        // Day-over-day comparison
        $dayComparison = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = today()->subDays($i);
            $filesCount = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                ->whereIn('editor_id', $editorIds)
                ->whereDate('created_at', $date)
                ->count();
            $backupsCount = Backup::whereHas('media', function ($q) use ($eventId, $editorIds, $date) {
                $q->when($eventId, fn($q2) => $q2->where('event_id', $eventId))
                    ->whereIn('editor_id', $editorIds)
                    ->whereDate('created_at', $date);
            })->count();

            $dayComparison[] = [
                'date' => $date->format('Y-m-d'),
                'day' => $date->format('D'),
                'files' => $filesCount,
                'backups' => $backupsCount,
            ];
        }

        return response()->json([
            'editor_leaderboard' => $editorLeaderboard,
            'group_comparison' => $groupComparison,
            'day_comparison' => $dayComparison,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Predictive/Planning Metrics - ETA, workload distribution
     */
    public function predictiveMetrics(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Determine scope
        if ($user->isAdmin()) {
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id')->toArray();
        } else {
            $groupIds = $user->ledGroups()->pluck('id')->toArray();
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id')->toArray();
        }

        // Current pending work
        $pendingCopies = CameraSession::where('status', 'active')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->sum('files_pending');

        $pendingBackups = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->whereDoesntHave('backups')
            ->count();

        $pendingVerification = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->whereHas('backups', fn($q) => $q->where('is_verified', false))
            ->count();

        // Processing rate (files per hour, last 4 hours)
        $filesLast4Hours = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->where('created_at', '>=', now()->subHours(4))
            ->count();
        $processingRate = $filesLast4Hours / 4;

        // ETA calculations
        $etaCopiesMinutes = $processingRate > 0 ? round(($pendingCopies / $processingRate) * 60) : null;
        $etaBackupsMinutes = $processingRate > 0 ? round(($pendingBackups / $processingRate) * 60) : null;

        // Workload distribution
        $onlineEditors = User::whereIn('id', $editorIds)
            ->where('is_online', true)
            ->where('last_seen_at', '>=', now()->subMinutes(5))
            ->count();

        $workloadPerEditor = $onlineEditors > 0 
            ? round(($pendingCopies + $pendingBackups) / $onlineEditors, 1) 
            : null;

        // Resource recommendation
        $recommendedEditors = $processingRate > 0 
            ? ceil(($pendingCopies + $pendingBackups) / ($processingRate * 2)) // Target 2 hours completion
            : null;

        $resourceStatus = 'optimal';
        if ($onlineEditors < $recommendedEditors) {
            $resourceStatus = 'understaffed';
        } elseif ($onlineEditors > $recommendedEditors * 1.5) {
            $resourceStatus = 'overstaffed';
        }

        // Workload by editor
        $editorWorkload = User::whereIn('id', $editorIds)
            ->get()
            ->map(function ($editor) use ($eventId) {
                $activeSessions = CameraSession::where('editor_id', $editor->id)
                    ->where('status', 'active')
                    ->when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->sum('files_pending');
                
                $isOnline = $editor->is_online && $editor->last_seen_at?->gte(now()->subMinutes(5));

                return [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'is_online' => $isOnline,
                    'pending_files' => $activeSessions,
                    'status' => !$isOnline ? 'offline' : ($activeSessions > 50 ? 'overloaded' : ($activeSessions > 0 ? 'busy' : 'available')),
                ];
            })
            ->sortByDesc('pending_files')
            ->values();

        return response()->json([
            'pending_work' => [
                'copies' => $pendingCopies,
                'backups' => $pendingBackups,
                'verification' => $pendingVerification,
                'total' => $pendingCopies + $pendingBackups + $pendingVerification,
            ],
            'processing_rate' => [
                'files_per_hour' => round($processingRate, 1),
                'files_last_4h' => $filesLast4Hours,
            ],
            'eta' => [
                'copies_minutes' => $etaCopiesMinutes,
                'copies_formatted' => $etaCopiesMinutes ? $this->formatMinutes($etaCopiesMinutes) : 'N/A',
                'backups_minutes' => $etaBackupsMinutes,
                'backups_formatted' => $etaBackupsMinutes ? $this->formatMinutes($etaBackupsMinutes) : 'N/A',
            ],
            'resources' => [
                'online_editors' => $onlineEditors,
                'recommended_editors' => $recommendedEditors,
                'workload_per_editor' => $workloadPerEditor,
                'status' => $resourceStatus,
            ],
            'editor_workload' => $editorWorkload,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Real-time Alerts Dashboard
     */
    public function alerts(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Determine scope
        if ($user->isAdmin()) {
            $editorIds = User::whereHas('roles', fn($q) => $q->where('slug', 'editor'))->pluck('id')->toArray();
        } else {
            $groupIds = $user->ledGroups()->pluck('id')->toArray();
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id')->toArray();
        }

        $alerts = collect();

        // Critical: File deletions (last 24h)
        $deletions = AuditLog::where('action', 'like', '%delete%')
            ->where('created_at', '>=', now()->subHours(24))
            ->whereIn('user_id', $editorIds)
            ->with('user')
            ->get()
            ->map(fn($log) => [
                'type' => 'deletion',
                'severity' => 'critical',
                'title' => 'File Deleted',
                'message' => "File deleted by {$log->user?->name}",
                'user' => $log->user?->name,
                'created_at' => $log->created_at->toIso8601String(),
                'time_ago' => $log->created_at->diffForHumans(),
            ]);
        $alerts = $alerts->merge($deletions);

        // Critical: Early SD removals (last 24h)
        $earlyRemovals = CameraSession::where('removal_decision', 'early_confirmed')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->where('ended_at', '>=', now()->subHours(24))
            ->with('editor')
            ->get()
            ->map(fn($s) => [
                'type' => 'early_removal',
                'severity' => $s->files_pending > 10 ? 'critical' : 'warning',
                'title' => 'Early SD Removal',
                'message' => "{$s->files_pending} files not copied - Camera {$s->camera_number}",
                'user' => $s->editor->name,
                'created_at' => $s->ended_at->toIso8601String(),
                'time_ago' => $s->ended_at->diffForHumans(),
            ]);
        $alerts = $alerts->merge($earlyRemovals);

        // Warning: Stalled sessions (no progress for 30+ min)
        $stalledSessions = CameraSession::where('status', 'active')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->where('updated_at', '<', now()->subMinutes(30))
            ->whereColumn('files_copied', '<', 'files_detected')
            ->with('editor')
            ->get()
            ->map(fn($s) => [
                'type' => 'stalled_session',
                'severity' => 'warning',
                'title' => 'Stalled Session',
                'message' => "No progress for " . $s->updated_at->diffInMinutes(now()) . " min - {$s->files_pending} files pending",
                'user' => $s->editor->name,
                'created_at' => $s->updated_at->toIso8601String(),
                'time_ago' => $s->updated_at->diffForHumans(),
            ]);
        $alerts = $alerts->merge($stalledSessions);

        // Warning: Editors offline with active sessions
        $offlineWithSessions = CameraSession::where('status', 'active')
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('editor_id', $editorIds)
            ->whereHas('editor', fn($q) => $q->where(function ($q2) {
                $q2->where('is_online', false)
                    ->orWhere('last_seen_at', '<', now()->subMinutes(10));
            }))
            ->with('editor')
            ->get()
            ->map(fn($s) => [
                'type' => 'offline_editor',
                'severity' => 'warning',
                'title' => 'Editor Offline',
                'message' => "{$s->editor->name} went offline with active session",
                'user' => $s->editor->name,
                'created_at' => $s->editor->last_seen_at?->toIso8601String() ?? now()->toIso8601String(),
                'time_ago' => $s->editor->last_seen_at?->diffForHumans() ?? 'Unknown',
            ]);
        $alerts = $alerts->merge($offlineWithSessions);

        // Info: Critical issues unacknowledged
        $criticalIssues = Issue::where('severity', 'critical')
            ->where('status', 'open')
            ->when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
            ->with('reporter')
            ->get()
            ->map(fn($i) => [
                'type' => 'critical_issue',
                'severity' => 'critical',
                'title' => 'Critical Issue Open',
                'message' => $i->description ?? "Issue #{$i->issue_id} needs attention",
                'user' => $i->reporter?->name,
                'created_at' => $i->created_at->toIso8601String(),
                'time_ago' => $i->created_at->diffForHumans(),
            ]);
        $alerts = $alerts->merge($criticalIssues);

        // Sort by severity and time
        $severityOrder = ['critical' => 0, 'warning' => 1, 'info' => 2];
        $sortedAlerts = $alerts->sortBy([
            fn($a, $b) => ($severityOrder[$a['severity']] ?? 3) <=> ($severityOrder[$b['severity']] ?? 3),
            fn($a, $b) => $b['created_at'] <=> $a['created_at'],
        ])->values();

        // Summary
        $summary = [
            'total' => $alerts->count(),
            'critical' => $alerts->where('severity', 'critical')->count(),
            'warning' => $alerts->where('severity', 'warning')->count(),
            'info' => $alerts->where('severity', 'info')->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'alerts' => $sortedAlerts->take(50),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Live Operations - Real-time SD sessions and camera activity
     * Per blueprint: The real-time nerve center
     */
    public function liveOperations(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $this->resolveEventId($request);
        if (!$eventId) {
            return response()->json([
                'error' => 'No active event. Activate an event before viewing live operations.',
                'code' => 'NO_ACTIVE_EVENT',
            ], 409);
        }

        // Scope based on role
        $groupIds = null;
        if ($user->isGroupLeader() && !$user->hasOperationalAccess()) {
            $groupIds = $user->ledGroups()->pluck('id')->toArray();
        }

        // Active SD sessions
        $activeSessions = CameraSession::with(['editor', 'event', 'sdCard'])
            ->where('event_id', $eventId)
            ->where('status', 'active')
            ->when($groupIds, function ($q) use ($groupIds) {
                $q->whereHas('editor', fn($eq) => $eq->whereHas('groups', fn($gq) => $gq->whereIn('groups.id', $groupIds)));
            })
            ->orderByDesc('started_at')
            ->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'camera_number' => $s->camera_number,
                'sd_label' => $s->sdCard?->sd_label,
                'event_name' => $s->event?->name ?? 'Unknown',
                'editor_name' => $s->editor?->name ?? 'Unknown',
                'group_code' => $s->editor?->groups->first()?->group_code ?? '',
                'files_total' => $s->files_detected ?? 0,
                'files_copied' => $s->files_copied ?? 0,
                'files_pending' => max(0, ($s->files_detected ?? 0) - ($s->files_copied ?? 0)),
                'status' => $s->status,
                'started_at' => $s->started_at?->toIso8601String(),
            ]);

        // Early removals today
        $earlyRemovals = CameraSession::with(['editor', 'sdCard'])
            ->where('event_id', $eventId)
            ->where('status', 'early_removed')
            ->whereDate('ended_at', today())
            ->when($groupIds, function ($q) use ($groupIds) {
                $q->whereHas('editor', fn($eq) => $eq->whereHas('groups', fn($gq) => $gq->whereIn('groups.id', $groupIds)));
            })
            ->orderByDesc('ended_at')
            ->get()
            ->map(fn($s) => [
                'id' => $s->id,
                'camera_number' => $s->camera_number,
                'sd_label' => $s->sdCard?->sd_label,
                'files_pending' => max(0, ($s->files_detected ?? 0) - ($s->files_copied ?? 0)),
                'editor_name' => $s->editor?->name ?? 'Unknown',
                'removed_at' => $s->ended_at?->toIso8601String(),
            ]);

        // Camera health overview
        $cameras = \App\Models\Camera::where('event_id', $eventId)
            ->withCount([
                // Camera issues are tracked via media issues; approximate by counting issues for this camera_number in this event.
            ])
            ->get()
            ->map(function ($c) use ($eventId) {
                $openIssues = Issue::whereIn('status', ['open', 'acknowledged'])
                    ->whereHas('media', function ($mq) use ($eventId, $c) {
                        $mq->where('event_id', $eventId)->where('camera_number', $c->camera_number);
                    })
                    ->count();

                $healthScore = $openIssues > 5 ? 30 : ($openIssues > 2 ? 60 : ($openIssues > 0 ? 80 : 95));

                return [
                    'camera_number' => $c->camera_number,
                    'health_score' => $healthScore,
                    'open_issues' => $openIssues,
                ];
            })
            ->sortBy('health_score')
            ->values();

        // Stats
        $totalCameras = $cameras->count();
        $camerasHealthy = $cameras->where('health_score', '>=', 80)->count();
        $camerasAttention = $cameras->where('health_score', '<', 60)->count();

        return response()->json([
            'activeSessions' => $activeSessions,
            'earlyRemovals' => $earlyRemovals,
            'cameraHealth' => $cameras->take(20),
            'stats' => [
                'totalActiveSessions' => $activeSessions->count(),
                'editorsOnline' => Agent::where('status', 'active')
                    ->where('last_seen_at', '>', now()->subMinutes(2))->count(),
                'camerasHealthy' => $camerasHealthy,
                'camerasAttention' => $camerasAttention,
                'earlyRemovalsToday' => $earlyRemovals->count(),
            ],
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Format minutes to human readable
     */
    private function formatMinutes($minutes): string
    {
        if ($minutes < 60) {
            return "{$minutes} min";
        }
        $hours = floor($minutes / 60);
        $mins = $minutes % 60;
        return $mins > 0 ? "{$hours}h {$mins}m" : "{$hours}h";
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
