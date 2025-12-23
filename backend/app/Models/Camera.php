<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Camera extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'camera_number',
        'name',
        'description',
        'status',
        'health_score',
    ];

    public function sdCards()
    {
        return $this->hasMany(SdCard::class);
    }

    public function isHealthy(): bool
    {
        return $this->health_score >= 80;
    }

    public function needsAttention(): bool
    {
        return $this->health_score < 50;
    }

    public function getHealthStatusAttribute(): string
    {
        if ($this->health_score >= 80) return 'healthy';
        if ($this->health_score >= 50) return 'monitor';
        return 'attention';
    }
}
