<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Event;
use App\Models\Media;
use App\Models\MediaDeletionTask;
use App\Services\PushNotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessMediaDeletion extends Command
{
    protected $signature = 'media:process-deletion {--force : Force deletion without confirmation}';
    protected $description = 'Process scheduled media deletions for data protection compliance';

    public function handle(): int
    {
        $this->info('Processing scheduled media deletions...');

        // Find events that should have their media deleted
        $events = Event::where('auto_delete_enabled', true)
            ->whereNull('media_deleted_at')
            ->where(function ($query) {
                $query->where(function ($q) {
                    // Delete by specific date
                    $q->whereNotNull('auto_delete_date')
                      ->where('auto_delete_date', '<=', now()->toDateString());
                })->orWhere(function ($q) {
                    // Delete by days after event end
                    $q->whereNotNull('auto_delete_days_after_end')
                      ->whereNotNull('end_date')
                      ->whereRaw('DATE_ADD(end_date, INTERVAL auto_delete_days_after_end DAY) <= ?', [now()->toDateString()]);
                });
            })
            ->get();

        if ($events->isEmpty()) {
            $this->info('No events scheduled for media deletion.');
            return 0;
        }

        $this->info("Found {$events->count()} event(s) ready for media deletion.");

        foreach ($events as $event) {
            $this->processEventDeletion($event);
        }

        $this->info('Media deletion processing complete.');
        return 0;
    }

    protected function processEventDeletion(Event $event): void
    {
        $this->info("Processing deletion for event: {$event->name} (ID: {$event->id})");

        $mediaCount = $event->media()->count();
        $tasksCreated = 0;
        $failedCount = 0;

        // Get all media for this event
        $mediaItems = $event->media()->get();

        // Calculate the exact deletion datetime
        $deletionDateTime = $this->calculateDeletionDateTime($event);

        foreach ($mediaItems as $media) {
            try {
                // Create deletion task for editor devices (NO server storage deletion)
                // Files are ONLY deleted from editor machines
                $this->createDeletionTask($event, $media, $deletionDateTime);
                $tasksCreated++;

                // Mark media record as scheduled for deletion (keep for audit)
                $media->update([
                    'deletion_scheduled_at' => $deletionDateTime,
                    'deletion_status' => 'scheduled',
                ]);

            } catch (\Exception $e) {
                Log::error("Failed to create deletion task for media {$media->id}: " . $e->getMessage());
                $failedCount++;
            }
        }

        // Mark event as having media deletion scheduled
        $event->update([
            'media_deleted_at' => now(),
            'deletion_reason' => "Data protection: {$tasksCreated} deletion tasks created for editor devices.",
        ]);

        // Log the deletion scheduling
        AuditLog::create([
            'action' => 'event.media_deletion_scheduled',
            'model_type' => 'Event',
            'model_id' => $event->id,
            'new_values' => [
                'total_media' => $mediaCount,
                'tasks_created' => $tasksCreated,
                'failed_count' => $failedCount,
                'scheduled_deletion_datetime' => $deletionDateTime->toDateTimeString(),
            ],
        ]);

        // Send notification to admins
        $this->notifyAdmins($event, $tasksCreated, $failedCount);

        $this->info("Event {$event->name}: Created {$tasksCreated} deletion tasks, {$failedCount} failed.");
    }

    /**
     * Calculate exact deletion datetime (date + time)
     */
    protected function calculateDeletionDateTime(Event $event): \Carbon\Carbon
    {
        // If specific datetime is set, use it
        if ($event->auto_delete_datetime) {
            return \Carbon\Carbon::parse($event->auto_delete_datetime);
        }

        // If specific date is set (use end of day)
        if ($event->auto_delete_date) {
            return \Carbon\Carbon::parse($event->auto_delete_date)->endOfDay();
        }

        // Calculate from days after event end
        if ($event->auto_delete_days_after_end && $event->end_date) {
            // Use the same time as event end, or end of day if no time specified
            $baseDate = $event->end_datetime ?? $event->end_date->endOfDay();
            return $baseDate->addDays($event->auto_delete_days_after_end);
        }

        // Default: 30 days after event end at midnight
        return ($event->end_date ?? now())->addDays(30)->endOfDay();
    }

    protected function createDeletionTask(Event $event, Media $media, \Carbon\Carbon $scheduledAt): void
    {
        // Create deletion tasks for EDITOR devices only
        // EXCLUDES: backup disks, archive storage, camera devices
        // Purpose: Wipe sensitive clips from editors' personal laptops after event
        
        $taskData = [
            'event_id' => $event->id,
            'event_name' => $event->name,
            'media_id' => $media->id,
            'filename' => $media->filename,
            'file_path' => $media->file_path,
            'file_size' => $media->file_size,
            'checksum' => $media->checksum,
            'status' => 'pending',
            'scheduled_at' => $scheduledAt, // Specific datetime for deletion
            // Include event dates for offline processing
            'event_start_date' => $event->start_date,
            'event_end_date' => $event->end_date,
            'event_end_datetime' => $event->end_datetime ?? $event->end_date?->endOfDay(),
            'auto_delete_days' => $event->auto_delete_days_after_end ?? 0,
        ];

        // Get all editor agents that participated in this event's sessions
        // EXCLUDE backup devices (device_type = 'backup')
        $editorAgents = \App\Models\Agent::whereHas('sessions', function ($query) use ($event) {
                $query->where('event_id', $event->id);
            })
            ->where('device_type', '!=', 'backup') // Exclude backup disks
            ->where('device_type', '!=', 'archive') // Exclude archive storage
            ->get();

        foreach ($editorAgents as $agent) {
            MediaDeletionTask::firstOrCreate([
                'event_id' => $event->id,
                'media_id' => $media->id,
                'device_id' => $agent->device_id,
            ], array_merge($taskData, [
                'device_id' => $agent->device_id,
                'agent_id' => $agent->id,
            ]));
        }

        // Also include the editor assigned to this media (if different)
        if ($media->editor_id) {
            $editor = \App\Models\User::find($media->editor_id);
            $editorAgents = $editor?->agents()
                ->where('device_type', '!=', 'backup')
                ->where('device_type', '!=', 'archive')
                ->get() ?? collect();
            
            foreach ($editorAgents as $agent) {
                MediaDeletionTask::firstOrCreate([
                    'event_id' => $event->id,
                    'media_id' => $media->id,
                    'device_id' => $agent->device_id,
                ], array_merge($taskData, [
                    'device_id' => $agent->device_id,
                    'agent_id' => $agent->id,
                ]));
            }
        }
    }

    protected function notifyAdmins(Event $event, int $deletedCount, int $failedCount): void
    {
        try {
            $notificationService = app(PushNotificationService::class);
            $notificationService->sendToAdmins(
                'Media Auto-Deleted',
                "Event '{$event->name}': {$deletedCount} media files automatically deleted for data protection.",
                [
                    'type' => 'media_auto_deleted',
                    'event_id' => $event->id,
                    'deleted_count' => $deletedCount,
                    'failed_count' => $failedCount,
                ]
            );
        } catch (\Exception $e) {
            Log::warning("Failed to send deletion notification: " . $e->getMessage());
        }
    }
}
