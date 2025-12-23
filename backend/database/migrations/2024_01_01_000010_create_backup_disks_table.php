<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_disks', function (Blueprint $table) {
            $table->id();
            $table->string('hardware_id')->unique();
            $table->string('name');
            $table->enum('purpose', ['primary', 'secondary', 'offsite'])->default('primary');
            $table->bigInteger('capacity_bytes')->nullable();
            $table->bigInteger('used_bytes')->default(0);
            $table->enum('status', ['active', 'full', 'retired', 'error'])->default('active');
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_disks');
    }
};
