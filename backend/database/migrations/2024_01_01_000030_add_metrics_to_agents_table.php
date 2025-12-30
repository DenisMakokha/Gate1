<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', function (Blueprint $table) {
            $table->integer('clips_copied_today')->default(0)->after('latency_ms');
            $table->integer('clips_renamed_today')->default(0)->after('clips_copied_today');
            $table->integer('clips_backed_up_today')->default(0)->after('clips_renamed_today');
            $table->integer('clips_copied_total')->default(0)->after('clips_backed_up_today');
            $table->integer('clips_renamed_total')->default(0)->after('clips_copied_total');
            $table->integer('clips_backed_up_total')->default(0)->after('clips_renamed_total');
            $table->date('metrics_date')->nullable()->after('clips_backed_up_total');
        });
    }

    public function down(): void
    {
        Schema::table('agents', function (Blueprint $table) {
            $table->dropColumn([
                'clips_copied_today',
                'clips_renamed_today',
                'clips_backed_up_today',
                'clips_copied_total',
                'clips_renamed_total',
                'clips_backed_up_total',
                'metrics_date',
            ]);
        });
    }
};
