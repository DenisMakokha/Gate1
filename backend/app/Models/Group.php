<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Group extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'group_code',
        'name',
        'description',
        'event_id',
        'leader_id',
        'leader_phone',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function leader()
    {
        return $this->belongsTo(User::class, 'leader_id');
    }

    public function members()
    {
        return $this->belongsToMany(User::class, 'group_members');
    }

    public function issues()
    {
        return $this->hasMany(Issue::class);
    }

    public function getOpenIssuesCountAttribute(): int
    {
        return $this->issues()->whereIn('status', ['open', 'acknowledged', 'in_progress'])->count();
    }
}
