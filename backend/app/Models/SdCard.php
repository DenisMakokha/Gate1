<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SdCard extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hardware_id',
        'fs_uuid',
        'sd_label',
        'camera_id',
        'camera_number',
        'capacity_bytes',
        'status',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    public function camera()
    {
        return $this->belongsTo(Camera::class);
    }

    public function cameraSessions()
    {
        return $this->hasMany(CameraSession::class);
    }

    public function media()
    {
        return $this->hasMany(Media::class);
    }

    public function getDisplayLabelAttribute(): string
    {
        return $this->camera_number . $this->sd_label;
    }
}
