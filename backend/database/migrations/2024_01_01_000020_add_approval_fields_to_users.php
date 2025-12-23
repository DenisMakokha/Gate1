<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('approval_status', ['pending', 'approved', 'rejected', 'suspended'])->default('approved')->after('is_active');
            $table->text('registration_notes')->nullable()->after('approval_status');
            $table->text('approval_notes')->nullable()->after('registration_notes');
            $table->foreignId('approved_by')->nullable()->after('approval_notes')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->string('invitation_token')->nullable()->unique()->after('approved_at');
            $table->timestamp('invitation_expires_at')->nullable()->after('invitation_token');
            $table->foreignId('invited_by')->nullable()->after('invitation_expires_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropForeign(['invited_by']);
            $table->dropColumn([
                'approval_status',
                'registration_notes',
                'approval_notes',
                'approved_by',
                'approved_at',
                'invitation_token',
                'invitation_expires_at',
                'invited_by',
            ]);
        });
    }
};
