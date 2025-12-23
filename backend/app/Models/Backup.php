<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Backup extends Model
{
    use HasFactory;

    protected $fillable = [
        'media_id',
        'backup_disk_id',
        'backed_up_by',
        'backup_path',
        'checksum',
        'is_verified',
        'verified_by',
        'verified_at',
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public function media()
    {
        return $this->belongsTo(Media::class);
    }

    public function backupDisk()
    {
        return $this->belongsTo(BackupDisk::class);
    }

    public function backedUpBy()
    {
        return $this->belongsTo(User::class, 'backed_up_by');
    }

    public function verifiedBy()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function verify(User $user): void
    {
        $this->update([
            'is_verified' => true,
            'verified_by' => $user->id,
            'verified_at' => now(),
        ]);
    }
}
