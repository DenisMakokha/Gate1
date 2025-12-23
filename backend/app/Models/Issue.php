<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Issue extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'issue_id',
        'media_id',
        'reported_by',
        'group_id',
        'type',
        'severity',
        'description',
        'status',
        'assigned_to',
        'resolved_by',
        'resolution_notes',
        'acknowledged_at',
        'resolved_at',
    ];

    protected $casts = [
        'acknowledged_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function reporter()
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function resolver()
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, ['open', 'acknowledged', 'in_progress']);
    }

    public function acknowledge(User $user): void
    {
        $this->update([
            'status' => 'acknowledged',
            'acknowledged_at' => now(),
            'assigned_to' => $user->id,
        ]);
    }

    public function resolve(User $user, string $notes = null): void
    {
        $this->update([
            'status' => 'resolved',
            'resolved_by' => $user->id,
            'resolved_at' => now(),
            'resolution_notes' => $notes,
        ]);
    }
}
