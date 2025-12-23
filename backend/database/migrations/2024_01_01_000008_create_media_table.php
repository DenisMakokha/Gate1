<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->string('media_id')->unique();
            $table->string('filename');
            $table->string('original_filename');
            $table->string('file_path');
            $table->string('checksum')->nullable();
            $table->bigInteger('size_bytes');
            $table->enum('type', ['before', 'after'])->default('before');
            
            // Parsed metadata from filename
            $table->string('full_name')->nullable();
            $table->integer('age')->nullable();
            $table->string('condition')->nullable();
            $table->string('region')->nullable();
            
            // Relationships
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->foreignId('editor_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('camera_session_id')->nullable()->constrained()->onDelete('set null');
            $table->integer('camera_number')->nullable();
            $table->foreignId('sd_card_id')->nullable()->constrained()->onDelete('set null');
            
            // Status tracking
            $table->enum('status', ['indexed', 'synced', 'backed_up', 'verified', 'issue'])->default('indexed');
            $table->enum('parse_status', ['valid', 'warning', 'error'])->default('valid');
            $table->json('parse_issues')->nullable();
            
            $table->string('thumbnail_path')->nullable();
            $table->string('device_id')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['full_name', 'region']);
            $table->index(['event_id', 'status']);
            $table->index(['editor_id', 'created_at']);
            $table->index('checksum');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
