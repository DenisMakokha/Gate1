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
                    'settings.manage',
                ],
            ],
            [
                'name' => 'Team Lead',
                'slug' => 'team-lead',
                'description' => 'Full event operations access. Can manage events, groups, cameras, media, and approvals. No system admin access.',
                'permissions' => [
                    'events.create', 'events.update', 'events.delete',
                    'groups.create', 'groups.update', 'groups.delete',
                    'cameras.manage',
                    'media.search', 'media.playback',
                    'issues.view_all', 'issues.acknowledge', 'issues.resolve', 'issues.escalate',
                    'backup.view', 'backup.verify',
                    'healing_cases.manage',
                    'approvals.manage',
                    'dashboard.admin',
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
                'name' => 'QA Lead',
                'slug' => 'qa-lead',
                'description' => 'Lead QA team, manage QA members, full quality control access.',
                'permissions' => [
                    'issues.view_all', 'issues.resolve', 'issues.escalate',
                    'media.view_issues_only', 'media.playback_issues',
                    'qa.offline_package',
                    'users.manage_qa', 'users.view',
                    'dashboard.qa',
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
                'name' => 'Backup Lead',
                'slug' => 'backup-lead',
                'description' => 'Lead backup team, manage backup members, full storage access.',
                'permissions' => [
                    'backup.view', 'backup.verify', 'backup.disk_manage',
                    'backup.manage',
                    'users.manage_backup', 'users.view',
                    'dashboard.backup',
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
