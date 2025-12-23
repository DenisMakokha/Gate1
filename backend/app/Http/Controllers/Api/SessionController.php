<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CameraSession;
use App\Models\Event;
use App\Models\SdCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SessionController extends Controller
{
    public function start(Request $request): JsonResponse
    {
        $request->validate([
            'event_id' => 'required|exists:events,id',
            'sd_card_id' => 'required|exists:sd_cards,id',
            'camera_number' => 'required|integer',
            'device_id' => 'required|string',
            'files_detected' => 'required|integer|min:0',
            'total_size_bytes' => 'required|integer|min:0',
        ]);

        $user = auth('api')->user();
        $sdCard = SdCard::find($request->sd_card_id);

        // Check for existing active session with this SD card
        $existingSession = CameraSession::where('sd_card_id', $request->sd_card_id)
            ->where('status', 'active')
            ->first();

        if ($existingSession) {
            return response()->json([
                'status' => 'existing',
                'session' => [
                    'session_id' => $existingSession->session_id,
                    'files_detected' => $existingSession->files_detected,
                    'files_copied' => $existingSession->files_copied,
                    'files_pending' => $existingSession->files_pending,
                ],
            ]);
        }

        $session = CameraSession::create([
            'session_id' => 'SESS-' . $sdCard->display_label . '-' . date('Y') . '-' . Str::random(4),
            'event_id' => $request->event_id,
            'sd_card_id' => $request->sd_card_id,
            'camera_number' => $request->camera_number,
            'editor_id' => $user->id,
            'device_id' => $request->device_id,
            'files_detected' => $request->files_detected,
            'total_size_bytes' => $request->total_size_bytes,
            'files_copied' => 0,
            'files_pending' => $request->files_detected,
            'status' => 'active',
            'started_at' => now(),
        ]);

        // Update SD card last used
        $sdCard->update(['last_used_at' => now()]);

        AuditLog::log('session.start', $user, 'CameraSession', $session->id);

        return response()->json([
            'status' => 'started',
            'session' => [
                'session_id' => $session->session_id,
                'camera_number' => $session->camera_number,
                'sd_label' => $sdCard->sd_label,
                'files_detected' => $session->files_detected,
            ],
        ], 201);
    }

    public function updateProgress(Request $request, string $sessionId): JsonResponse
    {
        $request->validate([
            'files_copied' => 'required|integer|min:0',
            'files_pending' => 'required|integer|min:0',
        ]);

        $session = CameraSession::where('session_id', $sessionId)->firstOrFail();

        $session->update([
            'files_copied' => $request->files_copied,
            'files_pending' => $request->files_pending,
        ]);

        return response()->json([
            'status' => 'updated',
            'copy_progress' => $session->copy_progress,
        ]);
    }

    public function end(Request $request, string $sessionId): JsonResponse
    {
        $request->validate([
            'removal_decision' => 'required|in:safe,early_confirmed',
            'files_copied' => 'required|integer|min:0',
            'files_pending' => 'required|integer|min:0',
        ]);

        $user = auth('api')->user();
        $session = CameraSession::where('session_id', $sessionId)->firstOrFail();

        $status = $request->files_pending === 0 ? 'completed' : 'early_removed';

        $session->update([
            'files_copied' => $request->files_copied,
            'files_pending' => $request->files_pending,
            'status' => $status,
            'removal_decision' => $request->removal_decision,
            'ended_at' => now(),
        ]);

        AuditLog::log('session.end', $user, 'CameraSession', $session->id, null, [
            'status' => $status,
            'removal_decision' => $request->removal_decision,
            'files_pending' => $request->files_pending,
        ]);

        // If early removal, notify group leader
        if ($request->removal_decision === 'early_confirmed' && $request->files_pending > 0) {
            // TODO: Send notification to group leader
            $this->notifyEarlyRemoval($session);
        }

        return response()->json([
            'status' => $status,
            'session_id' => $session->session_id,
        ]);
    }

    public function show(string $sessionId): JsonResponse
    {
        $session = CameraSession::where('session_id', $sessionId)
            ->with(['editor', 'sdCard', 'event'])
            ->firstOrFail();

        return response()->json([
            'session' => [
                'session_id' => $session->session_id,
                'camera_number' => $session->camera_number,
                'sd_label' => $session->sdCard->sd_label,
                'editor' => $session->editor->name,
                'event' => $session->event->name,
                'files_detected' => $session->files_detected,
                'files_copied' => $session->files_copied,
                'files_pending' => $session->files_pending,
                'copy_progress' => $session->copy_progress,
                'status' => $session->status,
                'removal_decision' => $session->removal_decision,
                'started_at' => $session->started_at,
                'ended_at' => $session->ended_at,
            ],
        ]);
    }

    public function active(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        $query = CameraSession::where('status', 'active')
            ->with(['editor', 'sdCard']);

        if (!$user->isAdmin()) {
            $query->where('editor_id', $user->id);
        }

        $sessions = $query->get()->map(fn($s) => [
            'session_id' => $s->session_id,
            'camera_number' => $s->camera_number,
            'sd_label' => $s->sdCard->sd_label,
            'editor' => $s->editor->name,
            'files_detected' => $s->files_detected,
            'files_copied' => $s->files_copied,
            'copy_progress' => $s->copy_progress,
            'started_at' => $s->started_at,
        ]);

        return response()->json(['sessions' => $sessions]);
    }

    private function notifyEarlyRemoval(CameraSession $session): void
    {
        // Get editor's group leader
        $editor = $session->editor;
        $group = $editor->groups()->first();

        if ($group && $group->leader) {
            // TODO: Implement push notification / WhatsApp notification
            // For now, just log it
            AuditLog::log('session.early_removal_notification', null, 'CameraSession', $session->id, null, [
                'leader_id' => $group->leader_id,
                'files_pending' => $session->files_pending,
            ]);
        }
    }
}
