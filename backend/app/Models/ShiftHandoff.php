<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftHandoff extends Model
{
    protected $fillable = [
        'event_id',
        'outgoing_shift_id',
        'incoming_shift_id',
        'outgoing_user_id',
        'incoming_user_id',
        'notes',
        'pending_tasks',
        'stats_snapshot',
        'status',
        'acknowledged_at',
    ];

    protected $casts = [
        'pending_tasks' => 'array',
        'stats_snapshot' => 'array',
        'acknowledged_at' => 'datetime',
    ];

    const STATUS_PENDING = 'pending';
    const STATUS_ACKNOWLEDGED = 'acknowledged';
    const STATUS_COMPLETED = 'completed';

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function outgoingShift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'outgoing_shift_id');
    }

    public function incomingShift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'incoming_shift_id');
    }

    public function outgoingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'outgoing_user_id');
    }

    public function incomingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'incoming_user_id');
    }

    public function acknowledge(): void
    {
        $this->update([
            'status' => self::STATUS_ACKNOWLEDGED,
            'acknowledged_at' => now(),
        ]);
    }
}
