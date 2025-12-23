<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityFeed extends Model
{
    protected $table = 'activity_feed';

    protected $fillable = [
        'event_id',
        'user_id',
        'group_id',
        'activity_type',
        'title',
        'description',
        'metadata',
        'icon',
        'color',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    // Activity types
    const TYPE_COPY_STARTED = 'copy_started';
    const TYPE_COPY_COMPLETED = 'copy_completed';
    const TYPE_COPY_INCOMPLETE = 'copy_incomplete';
    const TYPE_BACKUP_CREATED = 'backup_created';
    const TYPE_BACKUP_VERIFIED = 'backup_verified';
    const TYPE_ISSUE_REPORTED = 'issue_reported';
    const TYPE_ISSUE_RESOLVED = 'issue_resolved';
    const TYPE_EDITOR_ONLINE = 'editor_online';
    const TYPE_EDITOR_OFFLINE = 'editor_offline';
    const TYPE_SHIFT_STARTED = 'shift_started';
    const TYPE_SHIFT_ENDED = 'shift_ended';
    const TYPE_DISK_LOW_SPACE = 'disk_low_space';
    const TYPE_EVENT_STARTED = 'event_started';
    const TYPE_EVENT_COMPLETED = 'event_completed';

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /**
     * Log a copy session started
     */
    public static function logCopyStarted($session, User $editor): self
    {
        return self::create([
            'event_id' => $session->event_id,
            'user_id' => $editor->id,
            'group_id' => $editor->groups()->first()?->id,
            'activity_type' => self::TYPE_COPY_STARTED,
            'title' => "{$editor->name} started copying",
            'description' => "Camera {$session->camera_number} - {$session->files_detected} files detected",
            'metadata' => [
                'session_id' => $session->session_id,
                'camera_number' => $session->camera_number,
                'files_detected' => $session->files_detected,
            ],
            'icon' => 'copy',
            'color' => 'blue',
        ]);
    }

    /**
     * Log a copy session completed
     */
    public static function logCopyCompleted($session, User $editor): self
    {
        return self::create([
            'event_id' => $session->event_id,
            'user_id' => $editor->id,
            'group_id' => $editor->groups()->first()?->id,
            'activity_type' => self::TYPE_COPY_COMPLETED,
            'title' => "{$editor->name} completed copying",
            'description' => "{$session->files_copied} files from Camera {$session->camera_number}",
            'metadata' => [
                'session_id' => $session->session_id,
                'camera_number' => $session->camera_number,
                'files_copied' => $session->files_copied,
            ],
            'icon' => 'checkmark-circle',
            'color' => 'green',
        ]);
    }

    /**
     * Log incomplete copy (SD removed early)
     */
    public static function logCopyIncomplete($session, User $editor): self
    {
        return self::create([
            'event_id' => $session->event_id,
            'user_id' => $editor->id,
            'group_id' => $editor->groups()->first()?->id,
            'activity_type' => self::TYPE_COPY_INCOMPLETE,
            'title' => "{$editor->name} - incomplete copy",
            'description' => "{$session->files_pending} files remaining from Camera {$session->camera_number}",
            'metadata' => [
                'session_id' => $session->session_id,
                'files_pending' => $session->files_pending,
                'files_copied' => $session->files_copied,
            ],
            'icon' => 'warning',
            'color' => 'orange',
        ]);
    }

    /**
     * Log backup created
     */
    public static function logBackupCreated($backup, User $backupUser): self
    {
        return self::create([
            'event_id' => $backup->media?->event_id,
            'user_id' => $backupUser->id,
            'activity_type' => self::TYPE_BACKUP_CREATED,
            'title' => "{$backupUser->name} created backup",
            'description' => "Backed up to {$backup->disk->disk_label}",
            'metadata' => [
                'backup_id' => $backup->id,
                'disk_label' => $backup->disk->disk_label,
                'media_id' => $backup->media_id,
            ],
            'icon' => 'cloud-upload',
            'color' => 'purple',
        ]);
    }

    /**
     * Log backup verified
     */
    public static function logBackupVerified($backup, User $verifier): self
    {
        return self::create([
            'event_id' => $backup->media?->event_id,
            'user_id' => $verifier->id,
            'activity_type' => self::TYPE_BACKUP_VERIFIED,
            'title' => "{$verifier->name} verified backup",
            'description' => "Verified on {$backup->disk->disk_label}",
            'metadata' => [
                'backup_id' => $backup->id,
                'disk_label' => $backup->disk->disk_label,
            ],
            'icon' => 'shield-checkmark',
            'color' => 'green',
        ]);
    }

    /**
     * Log issue reported
     */
    public static function logIssueReported($issue, User $reporter): self
    {
        return self::create([
            'event_id' => $issue->media?->event_id,
            'user_id' => $reporter->id,
            'group_id' => $issue->group_id,
            'activity_type' => self::TYPE_ISSUE_REPORTED,
            'title' => "{$reporter->name} reported {$issue->severity} issue",
            'description' => $issue->type,
            'metadata' => [
                'issue_id' => $issue->issue_id,
                'severity' => $issue->severity,
                'type' => $issue->type,
            ],
            'icon' => 'alert-circle',
            'color' => $issue->severity === 'critical' ? 'red' : 'orange',
        ]);
    }

    /**
     * Log issue resolved
     */
    public static function logIssueResolved($issue, User $resolver): self
    {
        return self::create([
            'event_id' => $issue->media?->event_id,
            'user_id' => $resolver->id,
            'group_id' => $issue->group_id,
            'activity_type' => self::TYPE_ISSUE_RESOLVED,
            'title' => "{$resolver->name} resolved issue",
            'description' => $issue->type,
            'metadata' => [
                'issue_id' => $issue->issue_id,
            ],
            'icon' => 'checkmark-done',
            'color' => 'green',
        ]);
    }

    /**
     * Log editor came online
     */
    public static function logEditorOnline(User $editor): self
    {
        $activeEvent = Event::where('status', 'active')->first();
        
        return self::create([
            'event_id' => $activeEvent?->id,
            'user_id' => $editor->id,
            'group_id' => $editor->groups()->first()?->id,
            'activity_type' => self::TYPE_EDITOR_ONLINE,
            'title' => "{$editor->name} came online",
            'description' => null,
            'metadata' => [],
            'icon' => 'radio-button-on',
            'color' => 'green',
        ]);
    }

    /**
     * Log editor went offline
     */
    public static function logEditorOffline(User $editor): self
    {
        $activeEvent = Event::where('status', 'active')->first();
        
        return self::create([
            'event_id' => $activeEvent?->id,
            'user_id' => $editor->id,
            'group_id' => $editor->groups()->first()?->id,
            'activity_type' => self::TYPE_EDITOR_OFFLINE,
            'title' => "{$editor->name} went offline",
            'description' => null,
            'metadata' => [],
            'icon' => 'radio-button-off',
            'color' => 'gray',
        ]);
    }

    /**
     * Log low disk space alert
     */
    public static function logLowDiskSpace($disk, int $percentUsed): self
    {
        return self::create([
            'activity_type' => self::TYPE_DISK_LOW_SPACE,
            'title' => "Low disk space alert",
            'description' => "{$disk->disk_label} is {$percentUsed}% full",
            'metadata' => [
                'disk_id' => $disk->id,
                'disk_label' => $disk->disk_label,
                'percent_used' => $percentUsed,
            ],
            'icon' => 'hardware-chip',
            'color' => 'red',
        ]);
    }
}
