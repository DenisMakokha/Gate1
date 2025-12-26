<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use App\Models\Event;
use App\Models\Group;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class TestUserSeeder extends Seeder
{
    public function run(): void
    {
        // Get roles
        $adminRole = Role::where('slug', 'admin')->first();
        $teamLeadRole = Role::where('slug', 'team-lead')->first();
        $editorRole = Role::where('slug', 'editor')->first();
        $leaderRole = Role::where('slug', 'group-leader')->first();
        $qaLeadRole = Role::where('slug', 'qa-lead')->first();
        $qaRole = Role::where('slug', 'qa')->first();
        $backupLeadRole = Role::where('slug', 'backup-lead')->first();
        $backupRole = Role::where('slug', 'backup')->first();

        // Create Admin user
        $admin = User::firstOrCreate(
            ['email' => 'admin@gate1.com'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($adminRole) {
            $admin->roles()->syncWithoutDetaching([$adminRole->id]);
        }

        // Create test event
        $event = Event::where('code', 'TEST-2024')->first();
        if (!$event) {
            $eventId = DB::table('events')->insertGetId([
                'code' => 'TEST-2024',
                'name' => 'Test Event 2024',
                'description' => 'Test event for system testing',
                'start_date' => now(),
                'end_date' => now()->addDays(30),
                'location' => 'Test Location',
                'status' => 'active',
                'created_by' => $admin->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $event = Event::find($eventId);
        }

        // Create Group Leader user first (needed for group)
        $leader = User::firstOrCreate(
            ['email' => 'leader@gate1.com'],
            [
                'name' => 'Group Leader',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($leaderRole) {
            $leader->roles()->syncWithoutDetaching([$leaderRole->id]);
        }

        // Create test groups
        $groupA = Group::where('group_code', 'GRP-A')->first();
        if (!$groupA) {
            $groupA = Group::create([
                'group_code' => 'GRP-A',
                'name' => 'Alpha Team',
                'description' => 'First editing team',
                'event_id' => $event->id,
                'leader_id' => $leader->id,
            ]);
        }

        $groupB = Group::where('group_code', 'GRP-B')->first();
        if (!$groupB) {
            $groupB = Group::create([
                'group_code' => 'GRP-B',
                'name' => 'Beta Team',
                'description' => 'Second editing team',
                'event_id' => $event->id,
            ]);
        }

        // Create Editor user
        $editor = User::firstOrCreate(
            ['email' => 'editor@gate1.com'],
            [
                'name' => 'Test Editor',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($editorRole) {
            $editor->roles()->syncWithoutDetaching([$editorRole->id]);
        }

        // Assign editor and leader to group
        $groupA->members()->syncWithoutDetaching([$editor->id, $leader->id]);

        // Create Team Lead user
        $teamLead = User::firstOrCreate(
            ['email' => 'teamlead@gate1.com'],
            [
                'name' => 'Team Lead',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($teamLeadRole) {
            $teamLead->roles()->syncWithoutDetaching([$teamLeadRole->id]);
        }

        // Create QA Lead user
        $qaLead = User::firstOrCreate(
            ['email' => 'qalead@gate1.com'],
            [
                'name' => 'QA Lead',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($qaLeadRole) {
            $qaLead->roles()->syncWithoutDetaching([$qaLeadRole->id]);
        }

        // Create QA user
        $qa = User::firstOrCreate(
            ['email' => 'qa@gate1.com'],
            [
                'name' => 'QA Reviewer',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($qaRole) {
            $qa->roles()->syncWithoutDetaching([$qaRole->id]);
        }

        // Create Backup Lead user
        $backupLead = User::firstOrCreate(
            ['email' => 'backuplead@gate1.com'],
            [
                'name' => 'Backup Lead',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($backupLeadRole) {
            $backupLead->roles()->syncWithoutDetaching([$backupLeadRole->id]);
        }

        // Create Backup user
        $backup = User::firstOrCreate(
            ['email' => 'backup@gate1.com'],
            [
                'name' => 'Backup Operator',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ]
        );
        if ($backupRole) {
            $backup->roles()->syncWithoutDetaching([$backupRole->id]);
        }

        $this->command->info('Test data created:');
        $this->command->info('  Event: TEST-2024 (Test Event 2024)');
        $this->command->info('  Groups: GRP-A (Alpha Team), GRP-B (Beta Team)');
        $this->command->info('');
        $this->command->info('Test Credentials (all use password: password123):');
        $this->command->info('  Admin:        admin@gate1.com');
        $this->command->info('  Team Lead:    teamlead@gate1.com');
        $this->command->info('  Group Leader: leader@gate1.com');
        $this->command->info('  QA Lead:      qalead@gate1.com');
        $this->command->info('  QA:           qa@gate1.com');
        $this->command->info('  Backup Lead:  backuplead@gate1.com');
        $this->command->info('  Backup:       backup@gate1.com');
        $this->command->info('  Editor:       editor@gate1.com');
    }
}
