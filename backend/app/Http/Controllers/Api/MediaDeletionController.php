<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Event;
use App\Models\MediaDeletionTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaDeletionController extends Controller
{
    /**
     * Get auto-delete settings for an event
     */
    public function getSettings(int $eventId): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $event = Event::findOrFail($eventId);

        return response()->json([
            'event_id' => $event->id,
            'event_name' => $event->name,
            'end_date' => $event->end_date?->format('Y-m-d'),
            'auto_delete_enabled' => $event->auto_delete_enabled,
            'auto_delete_date' => $event->auto_delete_date?->format('Y-m-d'),
            'auto_delete_days_after_end' => $event->auto_delete_days_after_end,
            'media_deleted_at' => $event->media_deleted_at?->format('Y-m-d H:i:s'),
            'deletion_reason' => $event->deletion_reason,
            'media_count' => $event->media()->count(),
            'calculated_delete_date' => $this->calculateDeleteDate($event)?->format('Y-m-d'),
        ]);
    }

    /**
     * Update auto-delete settings for an event
     */
    public function updateSettings(Request $request, int $eventId): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'auto_delete_enabled' => 'required|boolean',
            'auto_delete_date' => 'nullable|date|after:today',
            'auto_delete_days_after_end' => 'nullable|integer|min:1|max:365',
        ]);

        $event = Event::findOrFail($eventId);

        // Prevent changes if media already deleted
        if ($event->media_deleted_at) {
            return response()->json([
                'error' => 'Media has already been deleted for this event',
            ], 400);
        }

        $oldValues = $event->only([
            'auto_delete_enabled',
            'auto_delete_date',
            'auto_delete_days_after_end',
        ]);

        $event->update([
            'auto_delete_enabled' => $request->auto_delete_enabled,
            'auto_delete_date' => $request->auto_delete_date,
            'auto_delete_days_after_end' => $request->auto_delete_days_after_end,
        ]);

        AuditLog::log('event.auto_delete_settings_updated', $user, 'Event', $event->id, $oldValues, [
            'auto_delete_enabled' => $request->auto_delete_enabled,
            'auto_delete_date' => $request->auto_delete_date,
            'auto_delete_days_after_end' => $request->auto_delete_days_after_end,
        ]);

        return response()->json([
            'message' => 'Auto-delete settings updated successfully',
            'calculated_delete_date' => $this->calculateDeleteDate($event)?->format('Y-m-d'),
        ]);
    }

    /**
     * Get pending deletion tasks for a device (used by desktop agent)
     * Only returns tasks for CLOSED events (event has ended)
     */
    public function getPendingTasks(Request $request): JsonResponse
    {
        $request->validate([
            'device_id' => 'required|string',
        ]);

        // Only get tasks for events that are CLOSED (end_date has passed)
        $tasks = MediaDeletionTask::where('device_id', $request->device_id)
            ->where('status', 'pending')
            ->whereHas('event', function ($query) {
                $query->where('status', 'closed')
                    ->orWhere(function ($q) {
                        $q->whereNotNull('end_date')
                          ->where('end_date', '<', now());
                    });
            })
            ->with(['event:id,name,end_date', 'media:id,filename,file_path,file_size,checksum'])
            ->get();

        return response()->json([
            'tasks' => $tasks->map(fn($task) => [
                'id' => $task->id,
                'event_id' => $task->event_id,
                'event_name' => $task->event?->name,
                'media_id' => $task->media_id,
                'file_path' => $task->file_path,
                'filename' => $task->filename ?? $task->media?->filename,
                'file_size' => $task->file_size ?? $task->media?->file_size,
                'checksum' => $task->checksum ?? $task->media?->checksum,
                'scheduled_at' => $task->scheduled_at->toDateTimeString(),
            ]),
            'count' => $tasks->count(),
        ]);
    }

    /**
     * Report deletion task completion (used by desktop agent)
     */
    public function reportTaskCompletion(Request $request): JsonResponse
    {
        $request->validate([
            'task_id' => 'required|integer',
            'device_id' => 'required|string',
            'status' => 'required|in:completed,failed',
            'error_message' => 'nullable|string',
        ]);

        $task = MediaDeletionTask::where('id', $request->task_id)
            ->where('device_id', $request->device_id)
            ->firstOrFail();

        if ($request->status === 'completed') {
            $task->markCompleted();
        } else {
            $task->markFailed($request->error_message ?? 'Unknown error');
        }

        return response()->json([
            'message' => 'Task status updated',
            'task_id' => $task->id,
            'status' => $task->status,
        ]);
    }

    /**
     * Manually trigger deletion for an event (admin only)
     */
    public function triggerDeletion(Request $request, int $eventId): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'confirm' => 'required|boolean|accepted',
            'reason' => 'required|string|min:10',
        ]);

        $event = Event::findOrFail($eventId);

        if ($event->media_deleted_at) {
            return response()->json([
                'error' => 'Media has already been deleted for this event',
            ], 400);
        }

        // Queue the deletion
        \Artisan::call('media:process-deletion', ['--force' => true]);

        // Force immediate deletion for this event
        $mediaCount = $event->media()->count();
        $deletedCount = 0;

        foreach ($event->media()->get() as $media) {
            try {
                // Create deletion tasks for offline devices
                MediaDeletionTask::create([
                    'event_id' => $event->id,
                    'media_id' => $media->id,
                    'device_id' => $media->device_id,
                    'file_path' => $media->file_path,
                    'status' => 'pending',
                    'scheduled_at' => now(),
                ]);

                // Soft delete the media record
                $media->delete();
                $deletedCount++;
            } catch (\Exception $e) {
                \Log::error("Failed to delete media {$media->id}: " . $e->getMessage());
            }
        }

        $event->update([
            'media_deleted_at' => now(),
            'deletion_reason' => "Manual deletion by {$user->name}: {$request->reason}",
        ]);

        AuditLog::log('event.media_manually_deleted', $user, 'Event', $event->id, null, [
            'reason' => $request->reason,
            'media_count' => $mediaCount,
            'deleted_count' => $deletedCount,
        ]);

        return response()->json([
            'message' => 'Media deletion initiated',
            'deleted_count' => $deletedCount,
            'total_media' => $mediaCount,
        ]);
    }

    /**
     * Get deletion status for all events
     */
    public function getDeletionStatus(): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $events = Event::select([
                'id', 'name', 'end_date', 'auto_delete_enabled',
                'auto_delete_date', 'auto_delete_days_after_end',
                'media_deleted_at', 'deletion_reason'
            ])
            ->withCount('media')
            ->orderBy('end_date', 'desc')
            ->get()
            ->map(function ($event) {
                return [
                    'id' => $event->id,
                    'name' => $event->name,
                    'end_date' => $event->end_date?->format('Y-m-d'),
                    'auto_delete_enabled' => $event->auto_delete_enabled,
                    'calculated_delete_date' => $this->calculateDeleteDate($event)?->format('Y-m-d'),
                    'media_count' => $event->media_count,
                    'media_deleted_at' => $event->media_deleted_at?->format('Y-m-d H:i:s'),
                    'deletion_reason' => $event->deletion_reason,
                    'status' => $this->getDeletionStatusLabel($event),
                ];
            });

        return response()->json($events);
    }

    protected function calculateDeleteDate(Event $event): ?\Carbon\Carbon
    {
        if ($event->auto_delete_date) {
            return \Carbon\Carbon::parse($event->auto_delete_date);
        }

        if ($event->auto_delete_days_after_end && $event->end_date) {
            return $event->end_date->addDays($event->auto_delete_days_after_end);
        }

        return null;
    }

    protected function getDeletionStatusLabel(Event $event): string
    {
        if ($event->media_deleted_at) {
            return 'deleted';
        }

        if (!$event->auto_delete_enabled) {
            return 'disabled';
        }

        $deleteDate = $this->calculateDeleteDate($event);
        if ($deleteDate && $deleteDate->isPast()) {
            return 'pending_deletion';
        }

        if ($deleteDate) {
            return 'scheduled';
        }

        return 'not_configured';
    }
}
