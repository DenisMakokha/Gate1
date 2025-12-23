<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'user_role',
        'action',
        'target_type',
        'target_id',
        'old_values',
        'new_values',
        'reason',
        'ip_address',
        'user_agent',
        'device_id',
        'created_at',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function log(
        string $action,
        ?User $user = null,
        ?string $targetType = null,
        ?int $targetId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $reason = null
    ): self {
        return self::create([
            'user_id' => $user?->id,
            'user_role' => $user?->roles->first()?->slug,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'reason' => $reason,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'device_id' => request()->header('X-Device-ID'),
            'created_at' => now(),
        ]);
    }
}
