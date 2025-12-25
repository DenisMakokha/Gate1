<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->boolean('auto_delete_enabled')->default(false)->after('status');
            $table->date('auto_delete_date')->nullable()->after('auto_delete_enabled');
            $table->integer('auto_delete_days_after_end')->nullable()->after('auto_delete_date');
            $table->timestamp('media_deleted_at')->nullable()->after('auto_delete_days_after_end');
            $table->text('deletion_reason')->nullable()->after('media_deleted_at');
        });

        // Create a table to track deletion tasks for offline devices
        Schema::create('media_deletion_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->foreignId('media_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('device_id')->nullable();
            $table->string('file_path');
            $table->string('status')->default('pending'); // pending, completed, failed
            $table->timestamp('scheduled_at');
            $table->timestamp('executed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
            
            $table->index(['device_id', 'status']);
            $table->index(['event_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn([
                'auto_delete_enabled',
                'auto_delete_date',
                'auto_delete_days_after_end',
                'media_deleted_at',
                'deletion_reason',
            ]);
        });

        Schema::dropIfExists('media_deletion_tasks');
    }
};
