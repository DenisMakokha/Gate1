<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BackupDisk extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hardware_id',
        'name',
        'purpose',
        'capacity_bytes',
        'used_bytes',
        'status',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    public function backups()
    {
        return $this->hasMany(Backup::class);
    }

    public function getUsagePercentageAttribute(): float
    {
        if ($this->capacity_bytes === 0) return 0;
        return round(($this->used_bytes / $this->capacity_bytes) * 100, 2);
    }

    public function getAvailableBytesAttribute(): int
    {
        return $this->capacity_bytes - $this->used_bytes;
    }

    public function isFull(): bool
    {
        return $this->usage_percentage >= 95;
    }
}
