<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name' => 'Administrator',
                'slug' => 'admin',
                'description' => 'Full system access. Can create events, assign roles, global search, and audit review.',
                'permissions' => [
                    'events.create', 'events.update', 'events.delete',
                    'groups.create', 'groups.update', 'groups.delete',
                    'users.manage', 'roles.assign',
                    'media.search', 'media.playback',
                    'issues.view_all', 'issues.escalate',
                    'backup.manage', 'audit.view',
                ],
            ],
            [
                'name' => 'Editor',
                'slug' => 'editor',
                'description' => 'Copy SD cards, manual rename, report issues, backup files.',
                'permissions' => [
                    'media.sync', 'media.rename',
                    'issues.report', 'issues.view_own',
                    'backup.create', 'backup.verify',
                    'session.manage',
                ],
            ],
            [
                'name' => 'Group Leader',
                'slug' => 'group-leader',
                'description' => 'Monitor group, respond to alerts, coordinate editors, escalate issues.',
                'permissions' => [
                    'group.view', 'group.members',
                    'issues.view_group', 'issues.acknowledge', 'issues.escalate',
                    'dashboard.group',
                ],
            ],
            [
                'name' => 'QA Team',
                'slug' => 'qa',
                'description' => 'Review issue-only videos, confirm fixes, offline review.',
                'permissions' => [
                    'issues.view_all', 'issues.resolve',
                    'media.view_issues_only', 'media.playback_issues',
                    'qa.offline_package',
                ],
            ],
            [
                'name' => 'Backup Team',
                'slug' => 'backup',
                'description' => 'Verify backups, disk rotation, monitor coverage.',
                'permissions' => [
                    'backup.view', 'backup.verify', 'backup.disk_manage',
                    'dashboard.backup',
                ],
            ],
        ];

        foreach ($roles as $roleData) {
            Role::updateOrCreate(
                ['slug' => $roleData['slug']],
                $roleData
            );
        }
    }
}
