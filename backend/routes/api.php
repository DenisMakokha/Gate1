<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BackupController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\GroupController;
use App\Http\Controllers\Api\IssueController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Gate 1 System API Routes
|--------------------------------------------------------------------------
*/

// Health Check Endpoint (public, no auth required)
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'app' => config('app.name'),
        'version' => '1.0.0',
        'timestamp' => now()->toISOString(),
        'services' => [
            'database' => \DB::connection()->getPdo() ? 'connected' : 'disconnected',
            'cache' => \Cache::store()->getStore() ? 'connected' : 'disconnected',
        ]
    ]);
});

use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\RegistrationController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\CameraController;
use App\Http\Controllers\Api\HealingCaseController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\ActivityFeedController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\StorageForecastController;
use App\Http\Controllers\Api\QualityControlController;
use App\Http\Controllers\Api\MediaDeletionController;
use App\Http\Controllers\Api\WorkAllocationController;

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [RegistrationController::class, 'register']);
Route::get('/groups/list', [GroupController::class, 'listForAgent']); // Public endpoint for agent setup
Route::post('/auth/register/invitation', [RegistrationController::class, 'registerWithInvitation']);
Route::get('/auth/invitation/{token}', [RegistrationController::class, 'checkInvitation']);
Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [PasswordResetController::class, 'resetPassword']);

// Protected routes
Route::middleware('auth:api')->group(function () {
    
    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/change-password', [PasswordResetController::class, 'changePassword']);
        Route::post('/fcm-token', [AuthController::class, 'updateFcmToken']);
    });

    // Agent routes (for desktop agent)
    Route::prefix('agent')->group(function () {
        Route::post('/register', [AgentController::class, 'register']);
        Route::post('/heartbeat', [AgentController::class, 'heartbeat']);
        Route::get('/config', [AgentController::class, 'config']);
        Route::post('/sd-card/bind', [AgentController::class, 'bindSdCard']);
        Route::get('/sd-card', [AgentController::class, 'getSdCard']);
    });

    // Camera session routes
    Route::prefix('session')->group(function () {
        Route::post('/start', [SessionController::class, 'start']);
        Route::put('/{sessionId}/progress', [SessionController::class, 'updateProgress']);
        Route::post('/{sessionId}/end', [SessionController::class, 'end']);
        Route::get('/{sessionId}', [SessionController::class, 'show']);
        Route::get('/', [SessionController::class, 'active']);
    });

    // Media routes
    Route::prefix('media')->group(function () {
        Route::post('/sync', [MediaController::class, 'sync']);
        Route::post('/batch-sync', [MediaController::class, 'batchSync']);
        Route::get('/search', [MediaController::class, 'search']);
        Route::get('/{mediaId}/status', [MediaController::class, 'status']);
        Route::post('/thumbnail', [MediaController::class, 'uploadThumbnail']);
        Route::get('/{mediaId}/download-url', [MediaController::class, 'getDownloadUrl']);
        Route::post('/{mediaId}/log-playback', [MediaController::class, 'logPlayback']);
        Route::post('/{mediaId}/log-download', [MediaController::class, 'logDownload']);
        Route::get('/{mediaId}/playback-source', [MediaController::class, 'getPlaybackSource']);
    });

    // Issue routes
    Route::prefix('issues')->group(function () {
        Route::get('/', [IssueController::class, 'index']);
        Route::post('/report', [IssueController::class, 'report']);
        Route::get('/group-summary', [IssueController::class, 'groupSummary']);
        Route::get('/{issueId}', [IssueController::class, 'show']);
        Route::post('/{issueId}/acknowledge', [IssueController::class, 'acknowledge']);
        Route::post('/{issueId}/resolve', [IssueController::class, 'resolve']);
        Route::post('/{issueId}/escalate', [IssueController::class, 'escalate']);
    });

    // Backup routes
    Route::prefix('backup')->group(function () {
        Route::post('/disk/register', [BackupController::class, 'registerDisk']);
        Route::post('/create', [BackupController::class, 'backup']);
        Route::post('/verify', [BackupController::class, 'verify']);
        Route::get('/coverage', [BackupController::class, 'coverage']);
        Route::get('/pending', [BackupController::class, 'pending']);
        Route::get('/analytics', [BackupController::class, 'analytics']);
        Route::get('/disk/{diskId}', [BackupController::class, 'diskStatus']);
        Route::get('/pending-by-editor', [BackupController::class, 'pendingByEditor']);
        Route::get('/pending-by-group', [BackupController::class, 'pendingByGroup']);
        Route::get('/editor-disk-assignments', [BackupController::class, 'editorDiskAssignments']);
        Route::get('/team-pending-total', [BackupController::class, 'teamPendingTotal']);
    });

    // Event routes
    Route::prefix('events')->group(function () {
        Route::get('/', [EventController::class, 'index']);
        Route::get('/active', [EventController::class, 'active']);
        Route::post('/', [EventController::class, 'store']);
        Route::get('/{id}', [EventController::class, 'show']);
        Route::put('/{id}', [EventController::class, 'update']);
        Route::post('/{id}/activate', [EventController::class, 'activate']);
        Route::post('/{id}/complete', [EventController::class, 'complete']);
        Route::get('/{id}/stats', [EventController::class, 'stats']);
    });

    // Group routes
    Route::prefix('groups')->group(function () {
        Route::get('/', [GroupController::class, 'index']);
        Route::post('/', [GroupController::class, 'store']);
        Route::post('/validate', [GroupController::class, 'validateGroupCode']);
        Route::get('/{id}', [GroupController::class, 'show']);
        Route::put('/{id}', [GroupController::class, 'update']);
        Route::get('/{id}/members', [GroupController::class, 'members']);
        Route::post('/{id}/members', [GroupController::class, 'addMember']);
        Route::delete('/{id}/members', [GroupController::class, 'removeMember']);
    });

    // Dashboard routes
    Route::prefix('dashboard')->group(function () {
        Route::get('/admin', [DashboardController::class, 'admin']);
        Route::get('/group-leader', [DashboardController::class, 'groupLeader']);
        Route::get('/qa', [DashboardController::class, 'qa']);
        Route::get('/backup', [DashboardController::class, 'backup']);
        Route::get('/editor', [DashboardController::class, 'editor']);
        Route::get('/workflow-progress', [DashboardController::class, 'workflowProgress']);
        Route::get('/time-analytics', [DashboardController::class, 'timeAnalytics']);
        Route::get('/incidents', [DashboardController::class, 'incidents']);
        Route::get('/sd-card-lifecycle', [DashboardController::class, 'sdCardLifecycle']);
        Route::get('/comparative', [DashboardController::class, 'comparativeAnalytics']);
        Route::get('/predictive', [DashboardController::class, 'predictiveMetrics']);
        Route::get('/alerts', [DashboardController::class, 'alerts']);
        Route::get('/live-operations', [DashboardController::class, 'liveOperations']);
    });

    // User management routes
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::get('/roles', [UserController::class, 'roles']);
        Route::get('/editors-status', [UserController::class, 'editorsStatus']);
        Route::post('/heartbeat', [UserController::class, 'heartbeat']);
        Route::post('/offline', [UserController::class, 'setOffline']);
        
        // Bulk import and invitations
        Route::post('/bulk-import', [UserController::class, 'bulkImport']);
        Route::get('/import-template', [UserController::class, 'downloadTemplate']);
        Route::get('/invitations', [UserController::class, 'listInvitations']);
        Route::post('/invitations', [UserController::class, 'createInvitation']);
        Route::delete('/invitations/{id}', [UserController::class, 'revokeInvitation']);
        
        Route::get('/{id}', [UserController::class, 'show']);
        Route::put('/{id}', [UserController::class, 'update']);
        Route::delete('/{id}', [UserController::class, 'destroy']);
        Route::post('/{id}/toggle-status', [UserController::class, 'toggleStatus']);
        Route::post('/{id}/groups', [UserController::class, 'assignGroups']);
    });

    // Audit log routes (admin only)
    Route::prefix('audit-logs')->group(function () {
        Route::get('/', [AuditLogController::class, 'index']);
        Route::get('/stats', [AuditLogController::class, 'stats']);
        Route::get('/actions', [AuditLogController::class, 'actions']);
        Route::get('/entity-types', [AuditLogController::class, 'entityTypes']);
        Route::get('/{id}', [AuditLogController::class, 'show']);
    });

    // Registration management routes (admin and group leaders)
    Route::prefix('registrations')->group(function () {
        Route::get('/pending', [RegistrationController::class, 'getPendingRegistrations']);
        Route::post('/invite', [RegistrationController::class, 'sendInvitation']);
        Route::post('/{id}/approve', [RegistrationController::class, 'approveRegistration']);
        Route::post('/{id}/reject', [RegistrationController::class, 'rejectRegistration']);
        Route::post('/{id}/suspend', [RegistrationController::class, 'suspendUser']);
        Route::post('/{id}/reactivate', [RegistrationController::class, 'reactivateUser']);
    });

    // System settings routes (admin only)
    Route::prefix('settings')->group(function () {
        Route::get('/', [SettingsController::class, 'index']);
        Route::put('/', [SettingsController::class, 'update']);
        Route::get('/smtp', [SettingsController::class, 'getSmtp']);
        Route::put('/smtp', [SettingsController::class, 'updateSmtp']);
        Route::post('/smtp/test', [SettingsController::class, 'testSmtp']);
        Route::get('/general', [SettingsController::class, 'getGeneral']);
        Route::put('/general', [SettingsController::class, 'updateGeneral']);
    });

    // Analytics routes
    Route::prefix('analytics')->group(function () {
        Route::get('/overview', [DashboardController::class, 'analyticsOverview']);
        Route::get('/media-trends', [DashboardController::class, 'mediaTrends']);
        Route::get('/issues-trends', [DashboardController::class, 'issuesTrends']);
        Route::get('/user-activity', [DashboardController::class, 'userActivity']);
    });

    // Camera routes
    Route::prefix('cameras')->group(function () {
        Route::get('/', [CameraController::class, 'index']);
        Route::post('/', [CameraController::class, 'store']);
        Route::get('/stats', [CameraController::class, 'getStats']);
        Route::get('/{camera}', [CameraController::class, 'show']);
        Route::put('/{camera}', [CameraController::class, 'update']);
        Route::delete('/{camera}', [CameraController::class, 'destroy']);
        Route::post('/{camera}/bind-sd', [CameraController::class, 'bindSdCard']);
        Route::post('/{camera}/unbind-sd', [CameraController::class, 'unbindSdCard']);
    });

    // Healing cases routes
    Route::prefix('healing-cases')->group(function () {
        Route::get('/', [HealingCaseController::class, 'index']);
        Route::post('/', [HealingCaseController::class, 'store']);
        Route::get('/stats', [HealingCaseController::class, 'getStats']);
        Route::get('/{healingCase}', [HealingCaseController::class, 'show']);
        Route::put('/{healingCase}', [HealingCaseController::class, 'update']);
        Route::delete('/{healingCase}', [HealingCaseController::class, 'destroy']);
        Route::post('/{healingCase}/verify', [HealingCaseController::class, 'verify']);
        Route::post('/{healingCase}/publish', [HealingCaseController::class, 'publish']);
    });

    // Export routes
    Route::prefix('export')->group(function () {
        Route::get('/media', [ExportController::class, 'exportMedia']);
        Route::get('/issues', [ExportController::class, 'exportIssues']);
        Route::get('/audit-logs', [ExportController::class, 'exportAuditLogs']);
        Route::get('/healing-cases', [ExportController::class, 'exportHealingCases']);
        Route::get('/backup-report', [ExportController::class, 'backupReport']);
        Route::get('/editor-performance', [ExportController::class, 'editorPerformanceReport']);
    });

    // Reports routes (JSON)
    Route::prefix('reports')->group(function () {
        Route::get('/daily-summary', [ExportController::class, 'dailySummary']);
        Route::get('/event/{eventId}', [ExportController::class, 'eventReport']);
        Route::get('/quick-stats', [ExportController::class, 'quickStats']);
    });

    // Activity Feed routes
    Route::prefix('activity-feed')->group(function () {
        Route::get('/', [ActivityFeedController::class, 'index']);
        Route::get('/timeline', [ActivityFeedController::class, 'timeline']);
        Route::get('/stats', [ActivityFeedController::class, 'stats']);
    });

    // Shift/Schedule routes
    Route::prefix('shifts')->group(function () {
        Route::get('/', [ShiftController::class, 'index']);
        Route::post('/', [ShiftController::class, 'store']);
        Route::post('/bulk', [ShiftController::class, 'bulkStore']);
        Route::get('/my-shifts', [ShiftController::class, 'myShifts']);
        Route::get('/today-overview', [ShiftController::class, 'todayOverview']);
        Route::post('/{shiftId}/check-in', [ShiftController::class, 'checkIn']);
        Route::post('/{shiftId}/check-out', [ShiftController::class, 'checkOut']);
        Route::post('/handoff', [ShiftController::class, 'createHandoff']);
        Route::get('/handoff/{handoffId}', [ShiftController::class, 'getHandoff']);
        Route::post('/handoff/{handoffId}/acknowledge', [ShiftController::class, 'acknowledgeHandoff']);
    });

    // Storage Forecast routes
    Route::prefix('storage')->group(function () {
        Route::get('/', [StorageForecastController::class, 'index']);
        Route::get('/disk/{diskId}', [StorageForecastController::class, 'diskDetail']);
        Route::post('/check-alerts', [StorageForecastController::class, 'checkAlerts']);
    });

    // Quality Control routes
    Route::prefix('quality-control')->group(function () {
        Route::get('/', [QualityControlController::class, 'index']);
        Route::get('/needs-training', [QualityControlController::class, 'needsTraining']);
        Route::get('/editor/{editorId}', [QualityControlController::class, 'editorReport']);
    });

    // Media Deletion / Data Protection routes
    Route::prefix('media-deletion')->group(function () {
        Route::get('/status', [MediaDeletionController::class, 'getDeletionStatus']);
        Route::get('/event/{eventId}', [MediaDeletionController::class, 'getSettings']);
        Route::put('/event/{eventId}', [MediaDeletionController::class, 'updateSettings']);
        Route::post('/event/{eventId}/trigger', [MediaDeletionController::class, 'triggerDeletion']);
        Route::get('/tasks', [MediaDeletionController::class, 'getPendingTasks']);
        Route::post('/tasks/complete', [MediaDeletionController::class, 'reportTaskCompletion']);
    });

    // Work Allocation routes
    Route::prefix('work-allocation')->group(function () {
        Route::get('/overview', [WorkAllocationController::class, 'overview']);
        Route::post('/assign', [WorkAllocationController::class, 'assign']);
        Route::post('/auto-distribute', [WorkAllocationController::class, 'autoDistribute']);
        Route::post('/reassign', [WorkAllocationController::class, 'reassign']);
    });
});
