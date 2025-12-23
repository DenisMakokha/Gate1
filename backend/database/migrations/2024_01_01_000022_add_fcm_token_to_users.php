<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('fcm_token')->nullable()->after('invitation_expires_at');
            $table->string('device_type')->nullable()->after('fcm_token'); // ios, android
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['fcm_token', 'device_type']);
        });
    }
};
