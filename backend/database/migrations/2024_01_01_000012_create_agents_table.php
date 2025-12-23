<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agents', function (Blueprint $table) {
            $table->id();
            $table->string('agent_id')->unique();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('device_id')->unique();
            $table->string('device_name')->nullable();
            $table->string('os')->nullable();
            $table->string('agent_version')->nullable();
            $table->string('token')->unique();
            $table->enum('status', ['active', 'inactive', 'revoked'])->default('active');
            $table->enum('sync_mode', ['metadata_only', 'full_upload'])->default('metadata_only');
            $table->json('watched_folders')->nullable();
            $table->integer('latency_ms')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agents');
    }
};
