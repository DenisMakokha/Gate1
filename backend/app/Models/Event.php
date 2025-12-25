<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Event extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'location',
        'start_date',
        'end_date',
        'status',
        'created_by',
        'auto_delete_enabled',
        'auto_delete_date',
        'auto_delete_days_after_end',
        'media_deleted_at',
        'deletion_reason',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'auto_delete_date' => 'date',
        'auto_delete_enabled' => 'boolean',
        'media_deleted_at' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function groups()
    {
        return $this->hasMany(Group::class);
    }

    public function cameraSessions()
    {
        return $this->hasMany(CameraSession::class);
    }

    public function media()
    {
        return $this->hasMany(Media::class);
    }

    public function healingCases()
    {
        return $this->hasMany(HealingCase::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function deletionTasks()
    {
        return $this->hasMany(MediaDeletionTask::class);
    }

    public function shouldAutoDelete(): bool
    {
        if (!$this->auto_delete_enabled || $this->media_deleted_at) {
            return false;
        }

        if ($this->auto_delete_date && $this->auto_delete_date->isPast()) {
            return true;
        }

        if ($this->auto_delete_days_after_end && $this->end_date) {
            $deleteDate = $this->end_date->addDays($this->auto_delete_days_after_end);
            return $deleteDate->isPast();
        }

        return false;
    }

    public function getAutoDeleteDateAttribute($value)
    {
        if ($value) {
            return \Carbon\Carbon::parse($value);
        }
        
        if ($this->auto_delete_days_after_end && $this->end_date) {
            return $this->end_date->addDays($this->auto_delete_days_after_end);
        }
        
        return null;
    }
}
