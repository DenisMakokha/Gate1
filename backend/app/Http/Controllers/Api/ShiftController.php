<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\ShiftHandoff;
use App\Models\Event;
use App\Models\User;
use App\Models\CameraSession;
use App\Models\Media;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    protected PushNotificationService $pushService;

    public function __construct(PushNotificationService $pushService)
    {
        $this->pushService = $pushService;
    }

    /**
     * Get shifts for a date/event
     */
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');
        $date = $request->get('date', today()->toDateString());

        $query = Shift::with(['user', 'group', 'event'])
            ->where('shift_date', $date)
            ->orderBy('start_time');

        if ($eventId) {
            $query->where('event_id', $eventId);
        }

        // Group leaders only see their groups
        if (!$user->isAdmin()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $query->whereIn('group_id', $groupIds);
        }

        $shifts = $query->get();

        // Group by time slots
        $grouped = $shifts->groupBy(fn($s) => $s->start_time->format('H:i') . '-' . $s->end_time->format('H:i'));

        return response()->json([
            'date' => $date,
            'shifts' => $shifts->map(fn($s) => $this->formatShift($s)),
            'by_time_slot' => $grouped->map(fn($group) => $group->map(fn($s) => $this->formatShift($s))),
            'summary' => [
                'total' => $shifts->count(),
                'scheduled' => $shifts->where('status', 'scheduled')->count(),
                'active' => $shifts->where('status', 'active')->count(),
                'completed' => $shifts->where('status', 'completed')->count(),
                'missed' => $shifts->where('status', 'missed')->count(),
            ],
        ]);
    }

    /**
     * Create a new shift
     */
    public function store(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'event_id' => 'required|exists:events,id',
            'user_id' => 'required|exists:users,id',
            'group_id' => 'nullable|exists:groups,id',
            'shift_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'notes' => 'nullable|string',
        ]);

        $shift = Shift::create([
            'event_id' => $request->event_id,
            'user_id' => $request->user_id,
            'group_id' => $request->group_id,
            'shift_date' => $request->shift_date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'notes' => $request->notes,
            'created_by' => $user->id,
        ]);

        $shift->load(['user', 'group', 'event']);

        return response()->json([
            'message' => 'Shift created successfully',
            'shift' => $this->formatShift($shift),
        ], 201);
    }

    /**
     * Bulk create shifts
     */
    public function bulkStore(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'event_id' => 'required|exists:events,id',
            'shifts' => 'required|array|min:1',
            'shifts.*.user_id' => 'required|exists:users,id',
            'shifts.*.group_id' => 'nullable|exists:groups,id',
            'shifts.*.shift_date' => 'required|date',
            'shifts.*.start_time' => 'required|date_format:H:i',
            'shifts.*.end_time' => 'required|date_format:H:i',
        ]);

        $created = [];
        foreach ($request->shifts as $shiftData) {
            $shift = Shift::create([
                'event_id' => $request->event_id,
                'user_id' => $shiftData['user_id'],
                'group_id' => $shiftData['group_id'] ?? null,
                'shift_date' => $shiftData['shift_date'],
                'start_time' => $shiftData['start_time'],
                'end_time' => $shiftData['end_time'],
                'notes' => $shiftData['notes'] ?? null,
                'created_by' => $user->id,
            ]);
            $created[] = $shift;
        }

        return response()->json([
            'message' => count($created) . ' shifts created successfully',
            'count' => count($created),
        ], 201);
    }

    /**
     * Get my shifts (for editors)
     */
    public function myShifts(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        $shifts = Shift::where('user_id', $user->id)
            ->where('shift_date', '>=', today())
            ->with(['event', 'group'])
            ->orderBy('shift_date')
            ->orderBy('start_time')
            ->limit(10)
            ->get();

        return response()->json([
            'shifts' => $shifts->map(fn($s) => $this->formatShift($s)),
            'next_shift' => $shifts->first() ? $this->formatShift($shifts->first()) : null,
        ]);
    }

    /**
     * Check in to shift
     */
    public function checkIn(Request $request, int $shiftId): JsonResponse
    {
        $user = auth('api')->user();
        $shift = Shift::findOrFail($shiftId);

        if ($shift->user_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($shift->status !== Shift::STATUS_SCHEDULED) {
            return response()->json(['error' => 'Shift cannot be checked in'], 400);
        }

        $shift->checkIn();

        return response()->json([
            'message' => 'Checked in successfully',
            'shift' => $this->formatShift($shift->fresh(['user', 'group'])),
        ]);
    }

    /**
     * Check out from shift
     */
    public function checkOut(Request $request, int $shiftId): JsonResponse
    {
        $user = auth('api')->user();
        $shift = Shift::findOrFail($shiftId);

        if ($shift->user_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($shift->status !== Shift::STATUS_ACTIVE) {
            return response()->json(['error' => 'Shift is not active'], 400);
        }

        $shift->checkOut();

        // Generate handoff report if there's an incoming shift
        $this->generateHandoffIfNeeded($shift);

        return response()->json([
            'message' => 'Checked out successfully',
            'shift' => $this->formatShift($shift->fresh(['user', 'group'])),
        ]);
    }

    /**
     * Get today's schedule overview
     */
    public function todayOverview(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        $query = Shift::where('shift_date', today())
            ->with(['user', 'group']);

        if ($eventId) {
            $query->where('event_id', $eventId);
        }

        if (!$user->isAdmin()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $query->whereIn('group_id', $groupIds);
        }

        $shifts = $query->orderBy('start_time')->get();

        // Get online status for scheduled users
        $userIds = $shifts->pluck('user_id')->unique();
        $onlineUsers = User::whereIn('id', $userIds)
            ->where('is_online', true)
            ->where('last_seen_at', '>', now()->subMinutes(5))
            ->pluck('id')
            ->toArray();

        // Current time slot
        $now = now();
        $currentShifts = $shifts->filter(fn($s) => $s->isCurrentlyActive());
        $upcomingShifts = $shifts->filter(fn($s) => 
            $s->status === Shift::STATUS_SCHEDULED && 
            $s->shift_date->copy()->setTimeFromTimeString($s->start_time->format('H:i:s'))->gt($now)
        );

        return response()->json([
            'current_shifts' => $currentShifts->map(fn($s) => array_merge(
                $this->formatShift($s),
                ['is_online' => in_array($s->user_id, $onlineUsers)]
            ))->values(),
            'upcoming_shifts' => $upcomingShifts->take(10)->map(fn($s) => array_merge(
                $this->formatShift($s),
                ['is_online' => in_array($s->user_id, $onlineUsers)]
            ))->values(),
            'summary' => [
                'total_today' => $shifts->count(),
                'currently_active' => $currentShifts->count(),
                'checked_in' => $shifts->where('status', Shift::STATUS_ACTIVE)->count(),
                'completed' => $shifts->where('status', Shift::STATUS_COMPLETED)->count(),
                'missed' => $shifts->where('status', Shift::STATUS_MISSED)->count(),
            ],
        ]);
    }

    /**
     * Create handoff report
     */
    public function createHandoff(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        $request->validate([
            'outgoing_shift_id' => 'required|exists:shifts,id',
            'incoming_shift_id' => 'required|exists:shifts,id',
            'notes' => 'nullable|string',
            'pending_tasks' => 'nullable|array',
        ]);

        $outgoingShift = Shift::findOrFail($request->outgoing_shift_id);
        $incomingShift = Shift::findOrFail($request->incoming_shift_id);

        // Generate stats snapshot
        $statsSnapshot = $this->generateStatsSnapshot($outgoingShift);

        $handoff = ShiftHandoff::create([
            'event_id' => $outgoingShift->event_id,
            'outgoing_shift_id' => $outgoingShift->id,
            'incoming_shift_id' => $incomingShift->id,
            'outgoing_user_id' => $outgoingShift->user_id,
            'incoming_user_id' => $incomingShift->user_id,
            'notes' => $request->notes,
            'pending_tasks' => $request->pending_tasks,
            'stats_snapshot' => $statsSnapshot,
        ]);

        // Notify incoming user
        $this->pushService->sendToUser(
            $incomingShift->user,
            '📋 Shift Handoff',
            "{$outgoingShift->user->name} has created a handoff report for you",
            ['type' => 'shift_handoff', 'handoff_id' => $handoff->id]
        );

        return response()->json([
            'message' => 'Handoff created successfully',
            'handoff' => $handoff->load(['outgoingUser', 'incomingUser']),
        ], 201);
    }

    /**
     * Get handoff details
     */
    public function getHandoff(int $handoffId): JsonResponse
    {
        $handoff = ShiftHandoff::with([
            'outgoingUser', 
            'incomingUser', 
            'outgoingShift', 
            'incomingShift',
            'event'
        ])->findOrFail($handoffId);

        return response()->json(['handoff' => $handoff]);
    }

    /**
     * Acknowledge handoff
     */
    public function acknowledgeHandoff(int $handoffId): JsonResponse
    {
        $user = auth('api')->user();
        $handoff = ShiftHandoff::findOrFail($handoffId);

        if ($handoff->incoming_user_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $handoff->acknowledge();

        return response()->json([
            'message' => 'Handoff acknowledged',
            'handoff' => $handoff->fresh(),
        ]);
    }

    /**
     * Generate stats snapshot for handoff
     */
    protected function generateStatsSnapshot(Shift $shift): array
    {
        $userId = $shift->user_id;
        $eventId = $shift->event_id;

        return [
            'files_copied' => CameraSession::where('editor_id', $userId)
                ->where('event_id', $eventId)
                ->whereDate('created_at', today())
                ->sum('files_copied'),
            'sessions_completed' => CameraSession::where('editor_id', $userId)
                ->where('event_id', $eventId)
                ->where('status', 'completed')
                ->whereDate('created_at', today())
                ->count(),
            'media_synced' => Media::where('editor_id', $userId)
                ->where('event_id', $eventId)
                ->whereDate('created_at', today())
                ->count(),
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Generate handoff if there's an incoming shift
     */
    protected function generateHandoffIfNeeded(Shift $outgoingShift): void
    {
        // Find next shift for same group/event
        $incomingShift = Shift::where('event_id', $outgoingShift->event_id)
            ->where('group_id', $outgoingShift->group_id)
            ->where('shift_date', $outgoingShift->shift_date)
            ->where('start_time', '>=', $outgoingShift->end_time)
            ->where('status', Shift::STATUS_SCHEDULED)
            ->orderBy('start_time')
            ->first();

        if ($incomingShift) {
            ShiftHandoff::create([
                'event_id' => $outgoingShift->event_id,
                'outgoing_shift_id' => $outgoingShift->id,
                'incoming_shift_id' => $incomingShift->id,
                'outgoing_user_id' => $outgoingShift->user_id,
                'incoming_user_id' => $incomingShift->user_id,
                'stats_snapshot' => $this->generateStatsSnapshot($outgoingShift),
            ]);
        }
    }

    protected function formatShift(Shift $shift): array
    {
        return [
            'id' => $shift->id,
            'event_id' => $shift->event_id,
            'event_name' => $shift->event?->name,
            'user_id' => $shift->user_id,
            'user_name' => $shift->user?->name,
            'group_id' => $shift->group_id,
            'group_code' => $shift->group?->group_code,
            'shift_date' => $shift->shift_date->toDateString(),
            'start_time' => $shift->start_time->format('H:i'),
            'end_time' => $shift->end_time->format('H:i'),
            'status' => $shift->status,
            'checked_in_at' => $shift->checked_in_at,
            'checked_out_at' => $shift->checked_out_at,
            'notes' => $shift->notes,
            'is_currently_active' => $shift->isCurrentlyActive(),
            'is_starting_soon' => $shift->isStartingSoon(),
        ];
    }
}
