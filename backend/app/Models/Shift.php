<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    protected $fillable = [
        'event_id',
        'user_id',
        'group_id',
        'shift_date',
        'start_time',
        'end_time',
        'status',
        'checked_in_at',
        'checked_out_at',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'shift_date' => 'date',
        'start_time' => 'datetime:H:i',
        'end_time' => 'datetime:H:i',
        'checked_in_at' => 'datetime',
        'checked_out_at' => 'datetime',
    ];

    const STATUS_SCHEDULED = 'scheduled';
    const STATUS_ACTIVE = 'active';
    const STATUS_COMPLETED = 'completed';
    const STATUS_MISSED = 'missed';
    const STATUS_CANCELLED = 'cancelled';

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function outgoingHandoffs(): HasMany
    {
        return $this->hasMany(ShiftHandoff::class, 'outgoing_shift_id');
    }

    public function incomingHandoffs(): HasMany
    {
        return $this->hasMany(ShiftHandoff::class, 'incoming_shift_id');
    }

    /**
     * Check if shift is currently active (within time window)
     */
    public function isCurrentlyActive(): bool
    {
        $now = now();
        $shiftStart = $this->shift_date->copy()->setTimeFromTimeString($this->start_time->format('H:i:s'));
        $shiftEnd = $this->shift_date->copy()->setTimeFromTimeString($this->end_time->format('H:i:s'));

        return $now->between($shiftStart, $shiftEnd);
    }

    /**
     * Check if shift is starting soon (within 15 minutes)
     */
    public function isStartingSoon(): bool
    {
        $now = now();
        $shiftStart = $this->shift_date->copy()->setTimeFromTimeString($this->start_time->format('H:i:s'));

        return $now->diffInMinutes($shiftStart, false) <= 15 && $now->diffInMinutes($shiftStart, false) > 0;
    }

    /**
     * Check in to shift
     */
    public function checkIn(): void
    {
        $this->update([
            'status' => self::STATUS_ACTIVE,
            'checked_in_at' => now(),
        ]);
    }

    /**
     * Check out from shift
     */
    public function checkOut(): void
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
            'checked_out_at' => now(),
        ]);
    }

    /**
     * Get shifts for today
     */
    public static function todayShifts($eventId = null)
    {
        return self::where('shift_date', today())
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->with(['user', 'group'])
            ->orderBy('start_time')
            ->get();
    }

    /**
     * Get upcoming shifts for a user
     */
    public static function upcomingForUser($userId, $limit = 5)
    {
        return self::where('user_id', $userId)
            ->where('shift_date', '>=', today())
            ->whereIn('status', [self::STATUS_SCHEDULED, self::STATUS_ACTIVE])
            ->orderBy('shift_date')
            ->orderBy('start_time')
            ->limit($limit)
            ->get();
    }
}
