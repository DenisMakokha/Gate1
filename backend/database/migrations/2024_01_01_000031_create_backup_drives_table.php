<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_drives', function (Blueprint $table) {
            $table->id();
            $table->string('hardware_id')->unique();
            $table->string('fs_uuid')->nullable();
            $table->string('label')->nullable();
            $table->string('serial_number')->nullable();
            $table->bigInteger('capacity_bytes')->nullable();
            $table->string('status')->default('active'); // active, retired
            $table->timestamp('last_used_at')->nullable();
            $table->unsignedBigInteger('bound_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('bound_by_user_id')->references('id')->on('users')->nullOnDelete();
            $table->index('hardware_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_drives');
    }
};
