<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            $table->date('shift_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->enum('status', ['scheduled', 'active', 'completed', 'missed', 'cancelled'])->default('scheduled');
            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('checked_out_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['event_id', 'shift_date']);
            $table->index(['user_id', 'shift_date']);
            $table->index(['status', 'shift_date']);
        });

        Schema::create('shift_handoffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outgoing_shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->foreignId('incoming_shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->foreignId('outgoing_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('incoming_user_id')->constrained('users')->cascadeOnDelete();
            $table->text('notes')->nullable();
            $table->json('pending_tasks')->nullable();
            $table->json('stats_snapshot')->nullable();
            $table->enum('status', ['pending', 'acknowledged', 'completed'])->default('pending');
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_handoffs');
        Schema::dropIfExists('shifts');
    }
};
