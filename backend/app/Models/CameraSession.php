<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CameraSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'event_id',
        'sd_card_id',
        'camera_number',
        'editor_id',
        'device_id',
        'files_detected',
        'total_size_bytes',
        'files_copied',
        'files_pending',
        'status',
        'removal_decision',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function sdCard()
    {
        return $this->belongsTo(SdCard::class);
    }

    public function editor()
    {
        return $this->belongsTo(User::class, 'editor_id');
    }

    public function media()
    {
        return $this->hasMany(Media::class);
    }

    public function isComplete(): bool
    {
        return $this->files_pending === 0;
    }

    public function getCopyProgressAttribute(): float
    {
        if ($this->files_detected === 0) return 100;
        return round(($this->files_copied / $this->files_detected) * 100, 2);
    }
}
