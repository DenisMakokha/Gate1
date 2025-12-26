<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'is_active',
        'approval_status',
        'registration_notes',
        'approval_notes',
        'approved_by',
        'approved_at',
        'invitation_token',
        'invitation_expires_at',
        'invited_by',
        'fcm_token',
        'device_type',
        'last_seen_at',
        'is_online',
        'current_activity',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_active' => 'boolean',
        'is_online' => 'boolean',
        'approved_at' => 'datetime',
        'invitation_expires_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [
            'roles' => $this->roles->pluck('slug')->toArray(),
        ];
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function hasRole(string $role): bool
    {
        return $this->roles()->where('slug', $role)->exists();
    }

    public function hasAnyRole(array $roles): bool
    {
        return $this->roles()->whereIn('slug', $roles)->exists();
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isTeamLead(): bool
    {
        return $this->hasRole('team-lead');
    }

    public function isEditor(): bool
    {
        return $this->hasRole('editor');
    }

    public function isGroupLeader(): bool
    {
        return $this->hasRole('group-leader');
    }

    public function isQALead(): bool
    {
        return $this->hasRole('qa-lead');
    }

    public function isQA(): bool
    {
        return $this->hasRole('qa');
    }

    public function isBackupLead(): bool
    {
        return $this->hasRole('backup-lead');
    }

    public function isBackupTeam(): bool
    {
        return $this->hasRole('backup');
    }

    /**
     * Check if user has operational admin access (admin or team-lead)
     */
    public function hasOperationalAccess(): bool
    {
        return $this->isAdmin() || $this->isTeamLead();
    }

    /**
     * Check if user can manage other users (any lead role)
     */
    public function canManageUsers(): bool
    {
        return $this->isAdmin() || $this->isTeamLead() || $this->isGroupLeader() || $this->isQALead() || $this->isBackupLead();
    }

    /**
     * Get the roles this user can assign to others
     */
    public function getManageableRoles(): array
    {
        if ($this->isAdmin()) {
            return ['admin', 'team-lead', 'group-leader', 'qa-lead', 'qa', 'backup-lead', 'backup', 'editor'];
        }
        if ($this->isTeamLead()) {
            return ['group-leader', 'qa-lead', 'qa', 'backup-lead', 'backup', 'editor'];
        }
        if ($this->isGroupLeader()) {
            return ['editor'];
        }
        if ($this->isQALead()) {
            return ['qa'];
        }
        if ($this->isBackupLead()) {
            return ['backup'];
        }
        return [];
    }

    public function agents()
    {
        return $this->hasMany(Agent::class);
    }

    public function ledGroups()
    {
        return $this->hasMany(Group::class, 'leader_id');
    }

    public function groups()
    {
        return $this->belongsToMany(Group::class, 'group_members');
    }

    public function media()
    {
        return $this->hasMany(Media::class, 'editor_id');
    }

    public function reportedIssues()
    {
        return $this->hasMany(Issue::class, 'reported_by');
    }

    public function assignedIssues()
    {
        return $this->hasMany(Issue::class, 'assigned_to');
    }
}
