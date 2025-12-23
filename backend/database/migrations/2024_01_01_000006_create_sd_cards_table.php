<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sd_cards', function (Blueprint $table) {
            $table->id();
            $table->string('hardware_id')->unique();
            $table->string('fs_uuid')->nullable();
            $table->string('sd_label');
            $table->foreignId('camera_id')->nullable()->constrained()->onDelete('set null');
            $table->integer('camera_number');
            $table->bigInteger('capacity_bytes')->nullable();
            $table->enum('status', ['active', 'inactive', 'retired'])->default('active');
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            $table->index(['camera_number', 'sd_label']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sd_cards');
    }
};
