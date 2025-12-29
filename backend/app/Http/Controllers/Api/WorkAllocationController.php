<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Group;
use App\Models\Media;
use App\Models\AuditLog;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkAllocationController extends Controller
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
    /**
     * Get workload overview with editor status
     */
    public function overview(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->hasOperationalAccess() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $this->resolveEventId($request);
        if (!$eventId) {
            return response()->json([
                'error' => 'No active event. Activate an event before viewing work allocation.',
                'code' => 'NO_ACTIVE_EVENT',
            ], 409);
        }

        // Get editors with their workload
        $editorsQuery = User::with(['roles', 'groups'])
            ->whereHas('roles', function ($q) {
                $q->where('slug', 'editor');
            });

        // Always scope to editors in groups for this event
        $editorsQuery->whereHas('groups', fn($q) => $q->where('groups.event_id', $eventId));

        // Group leaders can only see their group's editors
        if ($authUser->isGroupLeader() && !$authUser->hasOperationalAccess()) {
            $leaderGroupIds = $authUser->ledGroups()->pluck('id')->toArray();
            $editorsQuery->whereHas('groups', function ($q) use ($leaderGroupIds) {
                $q->whereIn('groups.id', $leaderGroupIds);
            });
        }

        $editors = $editorsQuery->get()->map(function ($editor) use ($eventId) {
            // Calculate workload stats
            $mediaAssigned = Media::where('event_id', $eventId)->where('assigned_to', $editor->id)->count();
            $mediaCompleted = Media::where('event_id', $eventId)->where('assigned_to', $editor->id)
                ->whereIn('status', ['completed', 'verified', 'backed_up'])
                ->count();
            
            // Calculate average processing time (mock for now)
            $avgProcessingTime = rand(8, 20);

            // Check if actually online (last seen within 5 minutes)
            $isActuallyOnline = $editor->is_online && 
                $editor->last_seen_at && 
                $editor->last_seen_at->gte(now()->subMinutes(5));

            return [
                'id' => $editor->id,
                'name' => $editor->name,
                'email' => $editor->email,
                'groups' => $editor->groups->map(fn($g) => [
                    'id' => $g->id,
                    'name' => $g->name,
                    'group_code' => $g->group_code,
                ]),
                'is_online' => $isActuallyOnline,
                'last_seen_at' => $editor->last_seen_at,
                'current_activity' => $isActuallyOnline ? $editor->current_activity : null,
                'media_assigned' => $mediaAssigned,
                'media_completed' => $mediaCompleted,
                'media_pending' => $mediaAssigned - $mediaCompleted,
                'avg_processing_time' => $avgProcessingTime,
            ];
        });

        // Get group workload summary
        $groupsQuery = Group::withCount(['members'])->where('event_id', $eventId);
        
        if ($authUser->isGroupLeader() && !$authUser->hasOperationalAccess()) {
            $groupsQuery->where('leader_id', $authUser->id);
        }

        $groups = $groupsQuery->get()->map(function ($group) use ($eventId) {
            $memberIds = $group->members()->pluck('users.id')->toArray();
            
            $totalMedia = Media::where('event_id', $eventId)->whereIn('assigned_to', $memberIds)->count();
            $completedMedia = Media::where('event_id', $eventId)->whereIn('assigned_to', $memberIds)
                ->whereIn('status', ['completed', 'verified', 'backed_up'])
                ->count();

            return [
                'id' => $group->id,
                'name' => $group->name,
                'code' => $group->group_code,
                'editor_count' => $group->members_count,
                'total_media' => $totalMedia,
                'completed_media' => $completedMedia,
                'pending_media' => $totalMedia - $completedMedia,
                'completion_percent' => $totalMedia > 0 
                    ? round(($completedMedia / $totalMedia) * 100) 
                    : 100,
            ];
        });

        // Get unassigned media
        $unassignedMedia = Media::where('event_id', $eventId)
            ->whereNull('assigned_to')
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(fn($m) => [
                'id' => $m->id,
                'filename' => $m->filename,
                'camera' => $m->camera_number ? ('CAM-' . str_pad((string) $m->camera_number, 3, '0', STR_PAD_LEFT)) : 'Unknown',
                'duration' => '0:00',
                'size' => $this->formatBytes($m->size_bytes ?? 0),
                'created_at' => $m->created_at,
            ]);

        // Summary stats
        $stats = [
            'total_editors' => $editors->count(),
            'online_editors' => $editors->where('is_online', true)->count(),
            'offline_editors' => $editors->where('is_online', false)->count(),
            'total_pending' => $editors->sum('media_pending'),
            'unassigned_count' => $unassignedMedia->count(),
        ];

        return response()->json([
            'editors' => $editors,
            'groups' => $groups,
            'unassigned_media' => $unassignedMedia,
            'stats' => $stats,
            'event_id' => $eventId,
        ]);
    }

    /**
     * Assign media to an editor
     */
    public function assign(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->hasOperationalAccess() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'editor_id' => 'required|exists:users,id',
            'media_ids' => 'required|array|min:1',
            'media_ids.*' => 'exists:media,id',
        ]);

        $editor = User::findOrFail($request->editor_id);

        // Verify editor is in a group the user can manage
        if ($authUser->isGroupLeader() && !$authUser->hasOperationalAccess()) {
            $leaderGroupIds = $authUser->ledGroups()->pluck('id')->toArray();
            $editorGroupIds = $editor->groups()->pluck('groups.id')->toArray();
            
            if (empty(array_intersect($leaderGroupIds, $editorGroupIds))) {
                return response()->json(['error' => 'Cannot assign to editors outside your groups'], 403);
            }
        }

        // Assign media
        $assignedCount = Media::whereIn('id', $request->media_ids)
            ->whereNull('assigned_to')
            ->update([
                'assigned_to' => $editor->id,
                'assigned_at' => now(),
                'assigned_by' => $authUser->id,
            ]);

        AuditLog::log('work.assign', $authUser, 'Media', null, null, [
            'editor_id' => $editor->id,
            'editor_name' => $editor->name,
            'media_count' => $assignedCount,
        ]);

        return response()->json([
            'message' => "Assigned {$assignedCount} files to {$editor->name}",
            'assigned_count' => $assignedCount,
        ]);
    }

    /**
     * Auto-distribute unassigned media evenly
     */
    public function autoDistribute(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->hasOperationalAccess()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'group_id' => 'nullable|exists:groups,id',
            'online_only' => 'boolean',
        ]);

        // Get eligible editors
        $editorsQuery = User::whereHas('roles', function ($q) {
            $q->where('slug', 'editor');
        });

        if ($request->filled('group_id')) {
            $editorsQuery->whereHas('groups', function ($q) use ($request) {
                $q->where('groups.id', $request->group_id);
            });
        }

        if ($request->get('online_only', true)) {
            $editorsQuery->where('is_online', true)
                ->where('last_seen_at', '>=', now()->subMinutes(5));
        }

        $editors = $editorsQuery->get();

        if ($editors->isEmpty()) {
            return response()->json(['error' => 'No eligible editors found'], 422);
        }

        // Get unassigned media
        $unassignedMedia = Media::whereNull('assigned_to')
            ->where('status', 'pending')
            ->pluck('id')
            ->toArray();

        if (empty($unassignedMedia)) {
            return response()->json(['message' => 'No unassigned media to distribute']);
        }

        // Calculate current workload and sort by least loaded
        $editorWorkloads = $editors->map(function ($editor) {
            $pending = Media::where('assigned_to', $editor->id)
                ->whereNotIn('status', ['completed', 'verified', 'backed_up'])
                ->count();
            return ['editor' => $editor, 'pending' => $pending];
        })->sortBy('pending')->values();

        // Distribute evenly
        $distribution = [];
        foreach ($unassignedMedia as $index => $mediaId) {
            $editorIndex = $index % $editorWorkloads->count();
            $editor = $editorWorkloads[$editorIndex]['editor'];
            
            if (!isset($distribution[$editor->id])) {
                $distribution[$editor->id] = [
                    'editor' => $editor,
                    'media_ids' => [],
                ];
            }
            $distribution[$editor->id]['media_ids'][] = $mediaId;
        }

        // Apply assignments
        $totalAssigned = 0;
        foreach ($distribution as $editorId => $data) {
            Media::whereIn('id', $data['media_ids'])->update([
                'assigned_to' => $editorId,
                'assigned_at' => now(),
                'assigned_by' => $authUser->id,
            ]);
            $totalAssigned += count($data['media_ids']);
        }

        AuditLog::log('work.auto_distribute', $authUser, 'Media', null, null, [
            'total_distributed' => $totalAssigned,
            'editors_count' => count($distribution),
        ]);

        return response()->json([
            'message' => "Auto-distributed {$totalAssigned} files to " . count($distribution) . " editors",
            'total_distributed' => $totalAssigned,
            'editors_count' => count($distribution),
            'distribution' => collect($distribution)->map(fn($d) => [
                'editor_id' => $d['editor']->id,
                'editor_name' => $d['editor']->name,
                'assigned_count' => count($d['media_ids']),
            ])->values(),
        ]);
    }

    /**
     * Reassign media from one editor to another
     */
    public function reassign(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->hasOperationalAccess() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'from_editor_id' => 'required|exists:users,id',
            'to_editor_id' => 'required|exists:users,id|different:from_editor_id',
            'media_ids' => 'nullable|array',
            'media_ids.*' => 'exists:media,id',
            'reassign_all_pending' => 'boolean',
        ]);

        $fromEditor = User::findOrFail($request->from_editor_id);
        $toEditor = User::findOrFail($request->to_editor_id);

        $query = Media::where('assigned_to', $fromEditor->id)
            ->whereNotIn('status', ['completed', 'verified', 'backed_up']);

        if ($request->filled('media_ids')) {
            $query->whereIn('id', $request->media_ids);
        }

        $reassignedCount = $query->update([
            'assigned_to' => $toEditor->id,
            'assigned_at' => now(),
            'assigned_by' => $authUser->id,
        ]);

        AuditLog::log('work.reassign', $authUser, 'Media', null, null, [
            'from_editor' => $fromEditor->name,
            'to_editor' => $toEditor->name,
            'count' => $reassignedCount,
        ]);

        return response()->json([
            'message' => "Reassigned {$reassignedCount} files from {$fromEditor->name} to {$toEditor->name}",
            'reassigned_count' => $reassignedCount,
        ]);
    }

    private function formatBytes($bytes): string
    {
        if ($bytes >= 1073741824) {
            return number_format($bytes / 1073741824, 1) . ' GB';
        } elseif ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 1) . ' MB';
        } elseif ($bytes >= 1024) {
            return number_format($bytes / 1024, 1) . ' KB';
        }
        return $bytes . ' B';
    }
}
