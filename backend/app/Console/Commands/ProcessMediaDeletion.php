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
        $deletedCount = 0;
        $failedCount = 0;

        // Get all media for this event
        $mediaItems = $event->media()->get();

        foreach ($mediaItems as $media) {
            try {
                // Create deletion task for each device that has this file
                $this->createDeletionTask($event, $media);

                // Delete from server storage if exists
                if ($media->file_path && Storage::exists($media->file_path)) {
                    Storage::delete($media->file_path);
                }

                // Delete thumbnail if exists
                if ($media->thumbnail_path && Storage::exists($media->thumbnail_path)) {
                    Storage::delete($media->thumbnail_path);
                }

                // Soft delete the media record (keep metadata for audit)
                $media->delete();
                $deletedCount++;

            } catch (\Exception $e) {
                Log::error("Failed to delete media {$media->id}: " . $e->getMessage());
                $failedCount++;
            }
        }

        // Mark event as having media deleted
        $event->update([
            'media_deleted_at' => now(),
            'deletion_reason' => "Automatic deletion for data protection. {$deletedCount} files deleted, {$failedCount} failed.",
        ]);

        // Log the deletion
        AuditLog::create([
            'action' => 'event.media_auto_deleted',
            'model_type' => 'Event',
            'model_id' => $event->id,
            'new_values' => [
                'total_media' => $mediaCount,
                'deleted_count' => $deletedCount,
                'failed_count' => $failedCount,
                'deletion_date' => now()->toDateTimeString(),
            ],
        ]);

        // Send notification to admins
        $this->notifyAdmins($event, $deletedCount, $failedCount);

        $this->info("Event {$event->name}: Deleted {$deletedCount} files, {$failedCount} failed.");
    }

    protected function createDeletionTask(Event $event, Media $media): void
    {
        // Create deletion tasks for all devices that might have this file
        // This ensures offline devices will delete when they come online
        
        if ($media->device_id) {
            MediaDeletionTask::create([
                'event_id' => $event->id,
                'media_id' => $media->id,
                'device_id' => $media->device_id,
                'file_path' => $media->file_path,
                'status' => 'pending',
                'scheduled_at' => now(),
            ]);
        }

        // Also create tasks for editor devices
        if ($media->editor_id) {
            $editorDevices = \App\Models\User::find($media->editor_id)?->devices ?? [];
            foreach ($editorDevices as $deviceId) {
                MediaDeletionTask::firstOrCreate([
                    'event_id' => $event->id,
                    'media_id' => $media->id,
                    'device_id' => $deviceId,
                ], [
                    'file_path' => $media->file_path,
                    'status' => 'pending',
                    'scheduled_at' => now(),
                ]);
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
