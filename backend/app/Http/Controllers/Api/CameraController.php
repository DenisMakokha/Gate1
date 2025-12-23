<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Camera;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CameraController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Camera::with(['group', 'currentSdCard']);

        if ($request->has('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('camera_id', 'like', "%{$search}%")
                  ->orWhere('model', 'like', "%{$search}%")
                  ->orWhere('serial_number', 'like', "%{$search}%");
            });
        }

        $cameras = $query->orderBy('camera_id')->paginate($request->get('per_page', 20));

        return response()->json($cameras);
    }

    public function store(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'camera_id' => 'required|string|unique:cameras,camera_id',
            'group_id' => 'required|exists:groups,id',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string|max:100',
            'status' => 'nullable|in:active,inactive,maintenance',
            'notes' => 'nullable|string',
        ]);

        $camera = Camera::create($validated);

        AuditLog::log('camera_created', 'Camera', $camera->id, null, $camera->toArray());

        return response()->json([
            'message' => 'Camera created successfully',
            'camera' => $camera->load('group'),
        ], 201);
    }

    public function show(Camera $camera): JsonResponse
    {
        $camera->load(['group', 'currentSdCard', 'sdCards']);

        return response()->json($camera);
    }

    public function update(Request $request, Camera $camera): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'camera_id' => 'sometimes|string|unique:cameras,camera_id,' . $camera->id,
            'group_id' => 'sometimes|exists:groups,id',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string|max:100',
            'status' => 'nullable|in:active,inactive,maintenance',
            'notes' => 'nullable|string',
        ]);

        $oldData = $camera->toArray();
        $camera->update($validated);

        AuditLog::log('camera_updated', 'Camera', $camera->id, $oldData, $camera->toArray());

        return response()->json([
            'message' => 'Camera updated successfully',
            'camera' => $camera->load('group'),
        ]);
    }

    public function destroy(Camera $camera): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $cameraData = $camera->toArray();
        $camera->delete();

        AuditLog::log('camera_deleted', 'Camera', $camera->id, $cameraData, null);

        return response()->json(['message' => 'Camera deleted successfully']);
    }

    public function bindSdCard(Request $request, Camera $camera): JsonResponse
    {
        $validated = $request->validate([
            'sd_card_id' => 'required|exists:sd_cards,id',
        ]);

        $camera->update(['current_sd_card_id' => $validated['sd_card_id']]);

        AuditLog::log('sd_card_bound', 'Camera', $camera->id, null, [
            'sd_card_id' => $validated['sd_card_id'],
        ]);

        return response()->json([
            'message' => 'SD card bound successfully',
            'camera' => $camera->load(['group', 'currentSdCard']),
        ]);
    }

    public function unbindSdCard(Camera $camera): JsonResponse
    {
        $oldSdCardId = $camera->current_sd_card_id;
        $camera->update(['current_sd_card_id' => null]);

        AuditLog::log('sd_card_unbound', 'Camera', $camera->id, [
            'sd_card_id' => $oldSdCardId,
        ], null);

        return response()->json([
            'message' => 'SD card unbound successfully',
            'camera' => $camera->load('group'),
        ]);
    }

    public function getStats(): JsonResponse
    {
        $stats = [
            'total' => Camera::count(),
            'active' => Camera::where('status', 'active')->count(),
            'inactive' => Camera::where('status', 'inactive')->count(),
            'maintenance' => Camera::where('status', 'maintenance')->count(),
            'with_sd_card' => Camera::whereNotNull('current_sd_card_id')->count(),
            'without_sd_card' => Camera::whereNull('current_sd_card_id')->count(),
        ];

        return response()->json($stats);
    }
}
