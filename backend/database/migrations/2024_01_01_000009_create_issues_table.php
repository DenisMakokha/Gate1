<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('issues', function (Blueprint $table) {
            $table->id();
            $table->string('issue_id')->unique();
            $table->foreignId('media_id')->constrained()->onDelete('cascade');
            $table->foreignId('reported_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('group_id')->nullable()->constrained()->onDelete('set null');
            
            $table->enum('type', [
                'no_audio',
                'low_audio', 
                'blurry',
                'shaky',
                'cut_interview',
                'filename_error',
                'duplicate',
                'other'
            ]);
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->text('description')->nullable();
            
            $table->enum('status', ['open', 'acknowledged', 'in_progress', 'resolved', 'escalated', 'closed'])->default('open');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->onDelete('set null');
            $table->text('resolution_notes')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['status', 'severity']);
            $table->index(['group_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('issues');
    }
};
