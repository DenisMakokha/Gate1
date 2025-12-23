<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Media extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'media_id',
        'filename',
        'original_filename',
        'file_path',
        'checksum',
        'size_bytes',
        'type',
        'full_name',
        'age',
        'condition',
        'region',
        'event_id',
        'editor_id',
        'camera_session_id',
        'camera_number',
        'sd_card_id',
        'status',
        'parse_status',
        'parse_issues',
        'thumbnail_path',
        'device_id',
    ];

    protected $casts = [
        'parse_issues' => 'array',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function editor()
    {
        return $this->belongsTo(User::class, 'editor_id');
    }

    public function cameraSession()
    {
        return $this->belongsTo(CameraSession::class);
    }

    public function sdCard()
    {
        return $this->belongsTo(SdCard::class);
    }

    public function issues()
    {
        return $this->hasMany(Issue::class);
    }

    public function backups()
    {
        return $this->hasMany(Backup::class);
    }

    public function beforeHealingCase()
    {
        return $this->hasOne(HealingCase::class, 'before_media_id');
    }

    public function afterHealingCase()
    {
        return $this->hasOne(HealingCase::class, 'after_media_id');
    }

    public function hasIssues(): bool
    {
        return $this->issues()->whereIn('status', ['open', 'acknowledged', 'in_progress'])->exists();
    }

    public function isBackedUp(): bool
    {
        return $this->backups()->where('is_verified', true)->exists();
    }

    public function getSizeFormattedAttribute(): string
    {
        $bytes = $this->size_bytes;
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        return round($bytes, 2) . ' ' . $units[$i];
    }
}
