<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('camera_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('session_id')->unique();
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->foreignId('sd_card_id')->constrained()->onDelete('cascade');
            $table->integer('camera_number');
            $table->foreignId('editor_id')->constrained('users')->onDelete('cascade');
            $table->string('device_id');
            $table->integer('files_detected')->default(0);
            $table->bigInteger('total_size_bytes')->default(0);
            $table->integer('files_copied')->default(0);
            $table->integer('files_pending')->default(0);
            $table->enum('status', ['active', 'completed', 'early_removed', 'error'])->default('active');
            $table->enum('removal_decision', ['safe', 'early_confirmed', 'pending'])->default('pending');
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            
            $table->index(['editor_id', 'status']);
            $table->index(['event_id', 'camera_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('camera_sessions');
    }
};
