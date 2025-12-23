<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Gate 2 System - Healing verification and before/after linkage
        Schema::create('healing_cases', function (Blueprint $table) {
            $table->id();
            $table->string('case_id')->unique();
            $table->foreignId('event_id')->constrained()->onDelete('cascade');
            $table->string('person_name');
            $table->integer('age')->nullable();
            $table->string('condition');
            $table->string('region');
            
            $table->foreignId('before_media_id')->nullable()->constrained('media')->onDelete('set null');
            $table->foreignId('after_media_id')->nullable()->constrained('media')->onDelete('set null');
            
            $table->enum('verification_status', ['pending', 'confirmed', 'partial', 'not_confirmed'])->default('pending');
            $table->foreignId('verified_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('verified_at')->nullable();
            $table->text('verification_notes')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['event_id', 'verification_status']);
            $table->index(['person_name', 'region']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('healing_cases');
    }
};
