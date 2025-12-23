<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agent extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'agent_id',
        'user_id',
        'device_id',
        'device_name',
        'os',
        'agent_version',
        'token',
        'status',
        'sync_mode',
        'watched_folders',
        'latency_ms',
        'last_seen_at',
    ];

    protected $hidden = [
        'token',
    ];

    protected $casts = [
        'watched_folders' => 'array',
        'last_seen_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isOnline(): bool
    {
        if (!$this->last_seen_at) return false;
        return $this->last_seen_at->diffInMinutes(now()) < 2;
    }

    public function getStatusDisplayAttribute(): string
    {
        if ($this->status === 'revoked') return 'revoked';
        return $this->isOnline() ? 'online' : 'offline';
    }
}
