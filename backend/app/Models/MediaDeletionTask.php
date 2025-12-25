<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaDeletionTask extends Model
{
    protected $fillable = [
        'event_id',
        'media_id',
        'device_id',
        'file_path',
        'status',
        'scheduled_at',
        'executed_at',
        'error_message',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'executed_at' => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function markCompleted(): void
    {
        $this->update([
            'status' => 'completed',
            'executed_at' => now(),
        ]);
    }

    public function markFailed(string $error): void
    {
        $this->update([
            'status' => 'failed',
            'executed_at' => now(),
            'error_message' => $error,
        ]);
    }

    public static function getPendingForDevice(string $deviceId)
    {
        return static::where('device_id', $deviceId)
            ->where('status', 'pending')
            ->where('scheduled_at', '<=', now())
            ->get();
    }
}
