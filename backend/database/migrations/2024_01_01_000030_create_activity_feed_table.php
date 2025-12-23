<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_feed', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            $table->string('activity_type', 50); // copy_started, copy_completed, backup_created, issue_reported, etc.
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('metadata')->nullable(); // Additional context data
            $table->string('icon')->nullable(); // Icon name for UI
            $table->string('color')->nullable(); // Color for UI
            $table->timestamps();

            $table->index(['event_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index(['activity_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_feed');
    }
};
