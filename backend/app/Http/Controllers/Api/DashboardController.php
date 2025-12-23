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
    public function admin(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        return response()->json([
            'overview' => [
                'total_media' => Media::when($eventId, fn($q) => $q->where('event_id', $eventId))->count(),
                'media_today' => Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                    ->whereDate('created_at', today())->count(),
                'open_issues' => Issue::whereIn('status', ['open', 'acknowledged', 'in_progress'])->count(),
                'critical_issues' => Issue::where('severity', 'critical')
                    ->whereIn('status', ['open', 'acknowledged'])->count(),
                'pending_backups' => Media::whereDoesntHave('backups', fn($q) => $q->where('is_verified', true))->count(),
                'active_sessions' => CameraSession::where('status', 'active')->count(),
                'online_agents' => Agent::where('status', 'active')
                    ->where('last_seen_at', '>', now()->subMinutes(2))->count(),
            ],
            'events' => Event::where('status', 'active')
                ->withCount('media')
                ->get()
                ->map(fn($e) => [
                    'id' => $e->id,
                    'name' => $e->name,
                    'media_count' => $e->media_count,
                ]),
            'groups_health' => Group::withCount([
                'issues as open_issues' => fn($q) => $q->whereIn('status', ['open', 'acknowledged']),
            ])->orderByDesc('open_issues')->limit(10)->get()
                ->map(fn($g) => [
                    'id' => $g->id,
                    'code' => $g->group_code,
                    'name' => $g->name,
                    'open_issues' => $g->open_issues,
                ]),
            'recent_issues' => Issue::with(['media', 'reporter'])
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

        if (!$user->isAdmin()) {
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

        if (!$user->isAdmin()) {
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

        if (!$user->isAdmin()) {
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

        if (!$user->isAdmin()) {
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

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Determine which groups/editors to include
        if ($user->isAdmin()) {
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
