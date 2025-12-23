<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_seen_at')->nullable()->after('device_type');
            $table->boolean('is_online')->default(false)->after('last_seen_at');
            $table->string('current_activity')->nullable()->after('is_online');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['last_seen_at', 'is_online', 'current_activity']);
        });
    }
};
