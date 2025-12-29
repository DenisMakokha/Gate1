<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityFeed;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityFeedController extends Controller
{
    /**
     * Get activity feed for an event or all recent activities
     */
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');
        $type = $request->get('type');
        $limit = min($request->get('limit', 50), 100);

        $query = ActivityFeed::with(['user', 'group'])
            ->orderByDesc('created_at');

        // Filter by event
        if ($eventId) {
            $query->where('event_id', $eventId);
        }

        // Filter by activity type
        if ($type) {
            $query->where('activity_type', $type);
        }

        // Group leaders only see their groups' activities
        if (!$user->hasOperationalAccess()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $query->where(function ($q) use ($groupIds, $user) {
                $q->whereIn('group_id', $groupIds)
                  ->orWhere('user_id', $user->id);
            });
        }

        $activities = $query->limit($limit)->get();

        return response()->json([
            'activities' => $activities->map(fn($a) => [
                'id' => $a->id,
                'type' => $a->activity_type,
                'title' => $a->title,
                'description' => $a->description,
                'icon' => $a->icon,
                'color' => $a->color,
                'user' => $a->user ? [
                    'id' => $a->user->id,
                    'name' => $a->user->name,
                ] : null,
                'group' => $a->group ? [
                    'id' => $a->group->id,
                    'code' => $a->group->group_code,
                ] : null,
                'metadata' => $a->metadata,
                'created_at' => $a->created_at,
                'time_ago' => $a->created_at->diffForHumans(),
            ]),
            'total' => $activities->count(),
        ]);
    }

    /**
     * Get activity feed grouped by time periods
     */
    public function timeline(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        $query = ActivityFeed::with(['user', 'group'])
            ->orderByDesc('created_at');

        if ($eventId) {
            $query->where('event_id', $eventId);
        }

        if (!$user->hasOperationalAccess()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $query->where(function ($q) use ($groupIds, $user) {
                $q->whereIn('group_id', $groupIds)
                  ->orWhere('user_id', $user->id);
            });
        }

        $activities = $query->limit(100)->get();

        // Group by time periods
        $grouped = [
            'last_hour' => [],
            'today' => [],
            'yesterday' => [],
            'older' => [],
        ];

        $now = now();
        foreach ($activities as $activity) {
            $data = [
                'id' => $activity->id,
                'type' => $activity->activity_type,
                'title' => $activity->title,
                'description' => $activity->description,
                'icon' => $activity->icon,
                'color' => $activity->color,
                'user_name' => $activity->user?->name,
                'group_code' => $activity->group?->group_code,
                'time' => $activity->created_at->format('H:i'),
                'time_ago' => $activity->created_at->diffForHumans(),
            ];

            if ($activity->created_at->gte($now->copy()->subHour())) {
                $grouped['last_hour'][] = $data;
            } elseif ($activity->created_at->isToday()) {
                $grouped['today'][] = $data;
            } elseif ($activity->created_at->isYesterday()) {
                $grouped['yesterday'][] = $data;
            } else {
                $grouped['older'][] = $data;
            }
        }

        return response()->json($grouped);
    }

    /**
     * Get activity statistics
     */
    public function stats(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->hasOperationalAccess() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');
        $today = now()->startOfDay();

        $baseQuery = ActivityFeed::when($eventId, fn($q) => $q->where('event_id', $eventId));

        if (!$user->hasOperationalAccess()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $baseQuery->where(function ($q) use ($groupIds, $user) {
                $q->whereIn('group_id', $groupIds)
                  ->orWhere('user_id', $user->id);
            });
        }

        $todayStats = (clone $baseQuery)->where('created_at', '>=', $today)
            ->selectRaw('activity_type, COUNT(*) as count')
            ->groupBy('activity_type')
            ->pluck('count', 'activity_type')
            ->toArray();

        $hourlyActivity = (clone $baseQuery)->where('created_at', '>=', $today)
            ->selectRaw('HOUR(created_at) as hour, COUNT(*) as count')
            ->groupBy('hour')
            ->orderBy('hour')
            ->get()
            ->map(fn($h) => [
                'hour' => sprintf('%02d:00', $h->hour),
                'count' => $h->count,
            ]);

        return response()->json([
            'today' => [
                'copies_started' => $todayStats[ActivityFeed::TYPE_COPY_STARTED] ?? 0,
                'copies_completed' => $todayStats[ActivityFeed::TYPE_COPY_COMPLETED] ?? 0,
                'backups_created' => $todayStats[ActivityFeed::TYPE_BACKUP_CREATED] ?? 0,
                'backups_verified' => $todayStats[ActivityFeed::TYPE_BACKUP_VERIFIED] ?? 0,
                'issues_reported' => $todayStats[ActivityFeed::TYPE_ISSUE_REPORTED] ?? 0,
                'issues_resolved' => $todayStats[ActivityFeed::TYPE_ISSUE_RESOLVED] ?? 0,
            ],
            'hourly_activity' => $hourlyActivity,
        ]);
    }
}
