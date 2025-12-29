<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BackupDisk;
use App\Models\Backup;
use App\Models\Media;
use App\Models\Event;
use App\Services\PushNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StorageForecastController extends Controller
{
    protected PushNotificationService $pushService;

    public function __construct(PushNotificationService $pushService)
    {
        $this->pushService = $pushService;
    }

    /**
     * Get storage overview and forecasts
     */
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isBackup() && !$user->isBackupLead()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');

        // Get all backup disks
        $disks = BackupDisk::with(['backups' => function ($q) {
            $q->select('backup_disk_id', DB::raw('COUNT(*) as backup_count'), DB::raw('SUM(size_bytes) as total_backed_up'))
              ->groupBy('backup_disk_id');
        }])->get();

        $diskStats = $disks->map(function ($disk) {
            $usedBytes = $disk->total_capacity_bytes - $disk->free_space_bytes;
            $usedPercent = $disk->total_capacity_bytes > 0 
                ? round(($usedBytes / $disk->total_capacity_bytes) * 100, 1) 
                : 0;

            return [
                'id' => $disk->id,
                'disk_label' => $disk->disk_label,
                'serial_number' => $disk->serial_number,
                'total_capacity' => $this->formatBytes($disk->total_capacity_bytes),
                'total_capacity_bytes' => $disk->total_capacity_bytes,
                'used_space' => $this->formatBytes($usedBytes),
                'used_bytes' => $usedBytes,
                'free_space' => $this->formatBytes($disk->free_space_bytes),
                'free_bytes' => $disk->free_space_bytes,
                'used_percent' => $usedPercent,
                'status' => $disk->status,
                'health' => $this->getDiskHealth($usedPercent),
                'last_backup_at' => $disk->last_backup_at,
            ];
        });

        // Calculate totals
        $totalCapacity = $disks->sum('total_capacity_bytes');
        $totalFree = $disks->sum('free_space_bytes');
        $totalUsed = $totalCapacity - $totalFree;

        // Get current event data rate
        $dataRate = $this->calculateDataRate($eventId);

        // Forecast
        $forecast = $this->generateForecast($totalFree, $dataRate);

        return response()->json([
            'disks' => $diskStats,
            'totals' => [
                'total_capacity' => $this->formatBytes($totalCapacity),
                'total_capacity_bytes' => $totalCapacity,
                'total_used' => $this->formatBytes($totalUsed),
                'total_used_bytes' => $totalUsed,
                'total_free' => $this->formatBytes($totalFree),
                'total_free_bytes' => $totalFree,
                'overall_used_percent' => $totalCapacity > 0 ? round(($totalUsed / $totalCapacity) * 100, 1) : 0,
                'disk_count' => $disks->count(),
                'healthy_disks' => $disks->where('status', 'active')->count(),
            ],
            'data_rate' => $dataRate,
            'forecast' => $forecast,
            'alerts' => $this->getStorageAlerts($diskStats),
        ]);
    }

    /**
     * Get detailed disk info
     */
    public function diskDetail(int $diskId): JsonResponse
    {
        $disk = BackupDisk::findOrFail($diskId);

        $usedBytes = $disk->total_capacity_bytes - $disk->free_space_bytes;
        $usedPercent = $disk->total_capacity_bytes > 0 
            ? round(($usedBytes / $disk->total_capacity_bytes) * 100, 1) 
            : 0;

        // Recent backups on this disk
        $recentBackups = Backup::where('backup_disk_id', $diskId)
            ->with(['media.editor', 'media.event'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn($b) => [
                'id' => $b->id,
                'media_filename' => $b->media?->filename,
                'editor' => $b->media?->editor?->name,
                'event' => $b->media?->event?->name,
                'size' => $this->formatBytes($b->size_bytes),
                'is_verified' => $b->is_verified,
                'created_at' => $b->created_at,
            ]);

        // Daily usage trend
        $dailyUsage = Backup::where('backup_disk_id', $diskId)
            ->where('created_at', '>=', now()->subDays(7))
            ->selectRaw('DATE(created_at) as date, SUM(size_bytes) as total_bytes, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'disk' => [
                'id' => $disk->id,
                'disk_label' => $disk->disk_label,
                'serial_number' => $disk->serial_number,
                'mount_path' => $disk->mount_path,
                'total_capacity' => $this->formatBytes($disk->total_capacity_bytes),
                'used_space' => $this->formatBytes($usedBytes),
                'free_space' => $this->formatBytes($disk->free_space_bytes),
                'used_percent' => $usedPercent,
                'status' => $disk->status,
                'registered_at' => $disk->created_at,
                'last_backup_at' => $disk->last_backup_at,
            ],
            'recent_backups' => $recentBackups,
            'daily_usage' => $dailyUsage,
            'estimated_days_remaining' => $this->estimateDaysRemaining($disk),
        ]);
    }

    /**
     * Check storage and send alerts if needed
     */
    public function checkAlerts(): JsonResponse
    {
        $disks = BackupDisk::where('status', 'active')->get();
        $alertsSent = 0;

        foreach ($disks as $disk) {
            $usedBytes = $disk->total_capacity_bytes - $disk->free_space_bytes;
            $usedPercent = $disk->total_capacity_bytes > 0 
                ? round(($usedBytes / $disk->total_capacity_bytes) * 100, 1) 
                : 0;

            // Alert at 90% usage
            if ($usedPercent >= 90) {
                $this->pushService->notifyLowDiskSpace($disk, $usedPercent);
                $alertsSent++;
            }
        }

        return response()->json([
            'checked' => $disks->count(),
            'alerts_sent' => $alertsSent,
        ]);
    }

    /**
     * Calculate current data rate (bytes per hour)
     */
    protected function calculateDataRate($eventId = null): array
    {
        // Last 24 hours
        $last24h = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->where('created_at', '>=', now()->subHours(24))
            ->sum('size_bytes');

        // Last hour
        $lastHour = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->where('created_at', '>=', now()->subHour())
            ->sum('size_bytes');

        // Average per hour over last 24h
        $avgPerHour = $last24h / 24;

        return [
            'last_hour' => $this->formatBytes($lastHour),
            'last_hour_bytes' => $lastHour,
            'avg_per_hour' => $this->formatBytes($avgPerHour),
            'avg_per_hour_bytes' => $avgPerHour,
            'last_24h_total' => $this->formatBytes($last24h),
            'last_24h_bytes' => $last24h,
            'projected_daily' => $this->formatBytes($avgPerHour * 24),
            'projected_daily_bytes' => $avgPerHour * 24,
        ];
    }

    /**
     * Generate storage forecast
     */
    protected function generateForecast(int $freeBytes, array $dataRate): array
    {
        $avgPerHour = $dataRate['avg_per_hour_bytes'];

        if ($avgPerHour <= 0) {
            return [
                'hours_remaining' => null,
                'days_remaining' => null,
                'estimated_full_at' => null,
                'status' => 'no_data',
                'message' => 'Not enough data to forecast',
            ];
        }

        $hoursRemaining = $freeBytes / $avgPerHour;
        $daysRemaining = $hoursRemaining / 24;
        $estimatedFullAt = now()->addHours($hoursRemaining);

        $status = 'healthy';
        $message = 'Storage is healthy';

        if ($daysRemaining < 1) {
            $status = 'critical';
            $message = 'Storage will be full within 24 hours!';
        } elseif ($daysRemaining < 3) {
            $status = 'warning';
            $message = 'Storage running low, consider adding more disks';
        } elseif ($daysRemaining < 7) {
            $status = 'caution';
            $message = 'Plan for additional storage soon';
        }

        return [
            'hours_remaining' => round($hoursRemaining, 1),
            'days_remaining' => round($daysRemaining, 1),
            'estimated_full_at' => $estimatedFullAt->toIso8601String(),
            'estimated_full_formatted' => $estimatedFullAt->format('M d, Y H:i'),
            'status' => $status,
            'message' => $message,
        ];
    }

    /**
     * Get storage alerts
     */
    protected function getStorageAlerts($diskStats): array
    {
        $alerts = [];

        foreach ($diskStats as $disk) {
            if ($disk['used_percent'] >= 95) {
                $alerts[] = [
                    'level' => 'critical',
                    'disk' => $disk['disk_label'],
                    'message' => "Disk {$disk['disk_label']} is {$disk['used_percent']}% full - CRITICAL",
                ];
            } elseif ($disk['used_percent'] >= 90) {
                $alerts[] = [
                    'level' => 'warning',
                    'disk' => $disk['disk_label'],
                    'message' => "Disk {$disk['disk_label']} is {$disk['used_percent']}% full",
                ];
            } elseif ($disk['status'] !== 'active') {
                $alerts[] = [
                    'level' => 'info',
                    'disk' => $disk['disk_label'],
                    'message' => "Disk {$disk['disk_label']} status: {$disk['status']}",
                ];
            }
        }

        return $alerts;
    }

    /**
     * Estimate days remaining for a disk
     */
    protected function estimateDaysRemaining(BackupDisk $disk): ?float
    {
        // Calculate average daily usage for this disk
        $avgDaily = Backup::where('backup_disk_id', $disk->id)
            ->where('created_at', '>=', now()->subDays(7))
            ->sum('size_bytes') / 7;

        if ($avgDaily <= 0) {
            return null;
        }

        return round($disk->free_space_bytes / $avgDaily, 1);
    }

    /**
     * Get disk health status
     */
    protected function getDiskHealth(float $usedPercent): string
    {
        if ($usedPercent >= 95) return 'critical';
        if ($usedPercent >= 90) return 'warning';
        if ($usedPercent >= 75) return 'caution';
        return 'healthy';
    }

    protected function formatBytes($bytes): string
    {
        if ($bytes == 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        return round($bytes, 2) . ' ' . $units[$i];
    }
}
