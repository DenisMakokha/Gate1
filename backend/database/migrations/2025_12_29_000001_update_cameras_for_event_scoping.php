<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cameras', function (Blueprint $table) {
            if (!Schema::hasColumn('cameras', 'camera_id')) {
                $table->string('camera_id')->nullable()->unique();
            }
            if (!Schema::hasColumn('cameras', 'group_id')) {
                $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();
            }
            if (!Schema::hasColumn('cameras', 'event_id')) {
                $table->foreignId('event_id')->nullable()->constrained()->cascadeOnDelete();
            }
            if (!Schema::hasColumn('cameras', 'model')) {
                $table->string('model', 100)->nullable();
            }
            if (!Schema::hasColumn('cameras', 'serial_number')) {
                $table->string('serial_number', 100)->nullable();
            }
            if (!Schema::hasColumn('cameras', 'notes')) {
                $table->text('notes')->nullable();
            }
            if (!Schema::hasColumn('cameras', 'current_sd_card_id')) {
                $table->foreignId('current_sd_card_id')->nullable()->constrained('sd_cards')->nullOnDelete();
            }
        });

        // Backfill camera_id for existing rows (non-destructive)
        if (Schema::hasColumn('cameras', 'camera_number') && Schema::hasColumn('cameras', 'camera_id')) {
            DB::table('cameras')
                ->whereNull('camera_id')
                ->update([
                    'camera_id' => DB::raw("CONCAT('CAM-', LPAD(camera_number, 3, '0'))"),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('cameras', function (Blueprint $table) {
            if (Schema::hasColumn('cameras', 'current_sd_card_id')) {
                $table->dropConstrainedForeignId('current_sd_card_id');
            }
            if (Schema::hasColumn('cameras', 'event_id')) {
                $table->dropConstrainedForeignId('event_id');
            }
            if (Schema::hasColumn('cameras', 'group_id')) {
                $table->dropConstrainedForeignId('group_id');
            }
            if (Schema::hasColumn('cameras', 'notes')) {
                $table->dropColumn('notes');
            }
            if (Schema::hasColumn('cameras', 'serial_number')) {
                $table->dropColumn('serial_number');
            }
            if (Schema::hasColumn('cameras', 'model')) {
                $table->dropColumn('model');
            }
            if (Schema::hasColumn('cameras', 'camera_id')) {
                $table->dropUnique(['camera_id']);
                $table->dropColumn('camera_id');
            }
        });
    }
};
