<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class HealingCase extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'case_id',
        'event_id',
        'person_name',
        'age',
        'condition',
        'region',
        'before_media_id',
        'after_media_id',
        'verification_status',
        'verified_by',
        'verified_at',
        'verification_notes',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function beforeMedia()
    {
        return $this->belongsTo(Media::class, 'before_media_id');
    }

    public function afterMedia()
    {
        return $this->belongsTo(Media::class, 'after_media_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function isLinked(): bool
    {
        return $this->before_media_id && $this->after_media_id;
    }

    public function isVerified(): bool
    {
        return $this->verification_status === 'confirmed';
    }
}
