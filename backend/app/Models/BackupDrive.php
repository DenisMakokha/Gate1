<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BackupDrive extends Model
{
    use HasFactory;

    protected $fillable = [
        'hardware_id',
        'fs_uuid',
        'label',
        'serial_number',
        'capacity_bytes',
        'status',
        'last_used_at',
        'bound_by_user_id',
    ];

    protected $casts = [
        'capacity_bytes' => 'integer',
        'last_used_at' => 'datetime',
    ];

    public function boundByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'bound_by_user_id');
    }

    public function getDisplayLabelAttribute(): string
    {
        if ($this->label) {
            return $this->label;
        }
        return 'Backup Drive ' . $this->id;
    }
}
