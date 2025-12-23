<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('type')->default('string'); // string, boolean, integer, json, encrypted
            $table->string('group')->default('general'); // general, smtp, notifications, etc.
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // Insert default SMTP settings
        $settings = [
            ['key' => 'smtp_host', 'value' => '', 'type' => 'string', 'group' => 'smtp', 'description' => 'SMTP server hostname'],
            ['key' => 'smtp_port', 'value' => '587', 'type' => 'integer', 'group' => 'smtp', 'description' => 'SMTP server port'],
            ['key' => 'smtp_username', 'value' => '', 'type' => 'string', 'group' => 'smtp', 'description' => 'SMTP username'],
            ['key' => 'smtp_password', 'value' => '', 'type' => 'encrypted', 'group' => 'smtp', 'description' => 'SMTP password'],
            ['key' => 'smtp_encryption', 'value' => 'tls', 'type' => 'string', 'group' => 'smtp', 'description' => 'SMTP encryption (tls/ssl/none)'],
            ['key' => 'smtp_from_address', 'value' => '', 'type' => 'string', 'group' => 'smtp', 'description' => 'Default from email address'],
            ['key' => 'smtp_from_name', 'value' => 'Gate 1 System', 'type' => 'string', 'group' => 'smtp', 'description' => 'Default from name'],
            ['key' => 'app_name', 'value' => 'Gate 1 System', 'type' => 'string', 'group' => 'general', 'description' => 'Application name'],
            ['key' => 'app_url', 'value' => 'http://localhost:3000', 'type' => 'string', 'group' => 'general', 'description' => 'Application URL'],
            ['key' => 'require_approval', 'value' => 'true', 'type' => 'boolean', 'group' => 'registration', 'description' => 'Require admin approval for new registrations'],
            ['key' => 'allow_self_registration', 'value' => 'true', 'type' => 'boolean', 'group' => 'registration', 'description' => 'Allow public self-registration'],
            ['key' => 'firebase_server_key', 'value' => '', 'type' => 'encrypted', 'group' => 'notifications', 'description' => 'Firebase Cloud Messaging server key'],
        ];

        foreach ($settings as $setting) {
            \DB::table('system_settings')->insert(array_merge($setting, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
