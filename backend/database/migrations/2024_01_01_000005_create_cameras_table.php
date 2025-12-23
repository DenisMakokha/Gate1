<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cameras', function (Blueprint $table) {
            $table->id();
            $table->integer('camera_number')->unique();
            $table->string('name')->nullable();
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive', 'maintenance'])->default('active');
            $table->integer('health_score')->default(100);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cameras');
    }
};
