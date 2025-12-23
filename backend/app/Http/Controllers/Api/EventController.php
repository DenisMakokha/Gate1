<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Event::query()->withCount(['media', 'groups', 'healingCases']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $events = $query->orderBy('start_date', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json($events);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:255',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $event = Event::create([
            'name' => $request->name,
            'code' => 'EVT-' . date('Y') . '-' . Str::random(6),
            'description' => $request->description,
            'location' => $request->location,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'status' => 'draft',
            'created_by' => $user->id,
        ]);

        AuditLog::log('event.create', $user, 'Event', $event->id);

        return response()->json([
            'status' => 'created',
            'event' => $event,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $event = Event::withCount(['media', 'groups', 'healingCases'])
            ->with(['creator'])
            ->findOrFail($id);

        return response()->json($event);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'nullable|in:draft,active,completed,archived',
        ]);

        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $event = Event::findOrFail($id);
        $oldValues = $event->toArray();

        $event->update($request->only([
            'name', 'description', 'location', 'start_date', 'end_date', 'status'
        ]));

        AuditLog::log('event.update', $user, 'Event', $event->id, $oldValues, $event->toArray());

        return response()->json([
            'status' => 'updated',
            'event' => $event,
        ]);
    }

    public function activate(int $id): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $event = Event::findOrFail($id);
        $event->update(['status' => 'active']);

        AuditLog::log('event.activate', $user, 'Event', $event->id);

        return response()->json(['status' => 'activated']);
    }

    public function complete(int $id): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $event = Event::findOrFail($id);
        $event->update(['status' => 'completed']);

        AuditLog::log('event.complete', $user, 'Event', $event->id);

        return response()->json(['status' => 'completed']);
    }

    public function stats(int $id): JsonResponse
    {
        $event = Event::findOrFail($id);

        $stats = [
            'total_media' => $event->media()->count(),
            'before_videos' => $event->media()->where('type', 'before')->count(),
            'after_videos' => $event->media()->where('type', 'after')->count(),
            'with_issues' => $event->media()->where('status', 'issue')->count(),
            'backed_up' => $event->media()->whereHas('backups', fn($q) => $q->where('is_verified', true))->count(),
            'healing_cases' => $event->healingCases()->count(),
            'verified_healings' => $event->healingCases()->where('verification_status', 'confirmed')->count(),
            'groups' => $event->groups()->count(),
            'active_sessions' => $event->cameraSessions()->where('status', 'active')->count(),
        ];

        return response()->json($stats);
    }

    public function active(): JsonResponse
    {
        $events = Event::where('status', 'active')
            ->withCount(['media', 'groups'])
            ->get();

        return response()->json($events);
    }
}
