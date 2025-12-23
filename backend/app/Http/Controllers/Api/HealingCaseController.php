<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HealingCase;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class HealingCaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HealingCase::with(['event', 'group', 'media']);

        if ($request->has('event_id')) {
            $query->where('event_id', $request->event_id);
        }

        if ($request->has('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('case_id', 'like', "%{$search}%")
                  ->orWhere('person_name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $cases = $query->orderBy('created_at', 'desc')->paginate($request->get('per_page', 20));

        return response()->json($cases);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_id' => 'required|exists:events,id',
            'group_id' => 'required|exists:groups,id',
            'person_name' => 'required|string|max:255',
            'description' => 'required|string',
            'healing_date' => 'required|date',
            'status' => 'nullable|in:pending,verified,published',
            'media_ids' => 'nullable|array',
            'media_ids.*' => 'exists:media,id',
        ]);

        $healingCase = HealingCase::create([
            'case_id' => 'HC-' . strtoupper(uniqid()),
            'event_id' => $validated['event_id'],
            'group_id' => $validated['group_id'],
            'person_name' => $validated['person_name'],
            'description' => $validated['description'],
            'healing_date' => $validated['healing_date'],
            'status' => $validated['status'] ?? 'pending',
        ]);

        if (!empty($validated['media_ids'])) {
            $healingCase->media()->attach($validated['media_ids']);
        }

        AuditLog::log('healing_case_created', 'HealingCase', $healingCase->id, null, $healingCase->toArray());

        return response()->json([
            'message' => 'Healing case created successfully',
            'healing_case' => $healingCase->load(['event', 'group', 'media']),
        ], 201);
    }

    public function show(HealingCase $healingCase): JsonResponse
    {
        $healingCase->load(['event', 'group', 'media']);

        return response()->json($healingCase);
    }

    public function update(Request $request, HealingCase $healingCase): JsonResponse
    {
        $validated = $request->validate([
            'person_name' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'healing_date' => 'sometimes|date',
            'status' => 'nullable|in:pending,verified,published',
            'media_ids' => 'nullable|array',
            'media_ids.*' => 'exists:media,id',
        ]);

        $oldData = $healingCase->toArray();

        $healingCase->update($validated);

        if (isset($validated['media_ids'])) {
            $healingCase->media()->sync($validated['media_ids']);
        }

        AuditLog::log('healing_case_updated', 'HealingCase', $healingCase->id, $oldData, $healingCase->toArray());

        return response()->json([
            'message' => 'Healing case updated successfully',
            'healing_case' => $healingCase->load(['event', 'group', 'media']),
        ]);
    }

    public function destroy(HealingCase $healingCase): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->isAdmin() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $caseData = $healingCase->toArray();
        $healingCase->delete();

        AuditLog::log('healing_case_deleted', 'HealingCase', $healingCase->id, $caseData, null);

        return response()->json(['message' => 'Healing case deleted successfully']);
    }

    public function verify(HealingCase $healingCase): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->isAdmin() && !$user->isQA()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $healingCase->update([
            'status' => 'verified',
            'verified_by' => $user->id,
            'verified_at' => now(),
        ]);

        AuditLog::log('healing_case_verified', 'HealingCase', $healingCase->id);

        return response()->json([
            'message' => 'Healing case verified',
            'healing_case' => $healingCase,
        ]);
    }

    public function publish(HealingCase $healingCase): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($healingCase->status !== 'verified') {
            return response()->json(['error' => 'Case must be verified before publishing'], 400);
        }

        $healingCase->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        AuditLog::log('healing_case_published', 'HealingCase', $healingCase->id);

        return response()->json([
            'message' => 'Healing case published',
            'healing_case' => $healingCase,
        ]);
    }

    public function getStats(): JsonResponse
    {
        $stats = [
            'total' => HealingCase::count(),
            'pending' => HealingCase::where('status', 'pending')->count(),
            'verified' => HealingCase::where('status', 'verified')->count(),
            'published' => HealingCase::where('status', 'published')->count(),
            'this_month' => HealingCase::whereMonth('created_at', now()->month)->count(),
        ];

        return response()->json($stats);
    }
}
