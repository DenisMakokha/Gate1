<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('media_id')->constrained()->onDelete('cascade');
            $table->foreignId('backup_disk_id')->constrained()->onDelete('cascade');
            $table->foreignId('backed_up_by')->constrained('users')->onDelete('cascade');
            $table->string('backup_path');
            $table->string('checksum')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->foreignId('verified_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            
            $table->unique(['media_id', 'backup_disk_id']);
            $table->index(['backup_disk_id', 'is_verified']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backups');
    }
};
