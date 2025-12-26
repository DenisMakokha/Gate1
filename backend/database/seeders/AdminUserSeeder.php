<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@gate1.cloud'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password123'),
            ]
        );

        $adminRole = Role::where('slug', 'admin')->first();
        
        if ($adminRole && !$user->roles()->where('role_id', $adminRole->id)->exists()) {
            $user->roles()->attach($adminRole->id);
        }

        $this->command->info('Admin user created: admin@gate1system.org / password123');
    }
}
