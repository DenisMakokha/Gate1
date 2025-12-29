<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\User;
use App\Models\Group;
use App\Models\Issue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QualityControlController extends Controller
{
    /**
     * Get quality control dashboard data
     */
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isQA() && !$user->isQALead() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');
        $days = $request->get('days', 7);

        // Overall parse status stats
        $parseStats = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->selectRaw('parse_status, COUNT(*) as count')
            ->groupBy('parse_status')
            ->pluck('count', 'parse_status')
            ->toArray();

        $totalMedia = array_sum($parseStats);
        $validCount = $parseStats['valid'] ?? 0;
        $warningCount = $parseStats['warning'] ?? 0;
        $errorCount = $parseStats['error'] ?? 0;

        // Error rate by editor
        $editorStats = $this->getEditorQualityStats($eventId, $user);

        // Error rate by group
        $groupStats = $this->getGroupQualityStats($eventId, $user);

        // Common filename issues
        $commonIssues = $this->getCommonFilenameIssues($eventId);

        // Daily trend
        $dailyTrend = $this->getDailyQualityTrend($eventId, $days);

        // Issue type breakdown
        $issueBreakdown = Issue::when($eventId, fn($q) => $q->whereHas('media', fn($m) => $m->where('event_id', $eventId)))
            ->selectRaw('type, COUNT(*) as count')
            ->groupBy('type')
            ->orderByDesc('count')
            ->limit(10)
            ->pluck('count', 'type')
            ->toArray();

        return response()->json([
            'overview' => [
                'total_media' => $totalMedia,
                'valid_count' => $validCount,
                'warning_count' => $warningCount,
                'error_count' => $errorCount,
                'valid_percentage' => $totalMedia > 0 ? round(($validCount / $totalMedia) * 100, 1) : 100,
                'error_rate' => $totalMedia > 0 ? round((($warningCount + $errorCount) / $totalMedia) * 100, 2) : 0,
            ],
            'by_editor' => $editorStats,
            'by_group' => $groupStats,
            'common_issues' => $commonIssues,
            'daily_trend' => $dailyTrend,
            'issue_breakdown' => $issueBreakdown,
        ]);
    }

    /**
     * Get editor quality stats
     */
    protected function getEditorQualityStats($eventId, $user): array
    {
        $query = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereNotNull('editor_id')
            ->selectRaw('editor_id, parse_status, COUNT(*) as count')
            ->groupBy('editor_id', 'parse_status');

        // Group leaders only see their editors
        if (!$user->isAdmin() && !$user->isQA() && !$user->isQALead()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $editorIds = User::whereHas('groups', fn($q) => $q->whereIn('groups.id', $groupIds))->pluck('id');
            $query->whereIn('editor_id', $editorIds);
        }

        $results = $query->get();

        // Group by editor
        $editorData = [];
        foreach ($results as $row) {
            if (!isset($editorData[$row->editor_id])) {
                $editorData[$row->editor_id] = [
                    'valid' => 0,
                    'warning' => 0,
                    'error' => 0,
                    'total' => 0,
                ];
            }
            $editorData[$row->editor_id][$row->parse_status] = $row->count;
            $editorData[$row->editor_id]['total'] += $row->count;
        }

        // Get editor names and calculate rates
        $editors = User::whereIn('id', array_keys($editorData))->get()->keyBy('id');

        $stats = [];
        foreach ($editorData as $editorId => $data) {
            $editor = $editors[$editorId] ?? null;
            if (!$editor) continue;

            $errorRate = $data['total'] > 0 
                ? round((($data['warning'] + $data['error']) / $data['total']) * 100, 2) 
                : 0;

            $stats[] = [
                'editor_id' => $editorId,
                'editor_name' => $editor->name,
                'total_files' => $data['total'],
                'valid' => $data['valid'],
                'warnings' => $data['warning'],
                'errors' => $data['error'],
                'error_rate' => $errorRate,
                'quality_score' => 100 - $errorRate,
                'needs_training' => $errorRate > 10,
            ];
        }

        // Sort by error rate descending
        usort($stats, fn($a, $b) => $b['error_rate'] <=> $a['error_rate']);

        return $stats;
    }

    /**
     * Get group quality stats
     */
    protected function getGroupQualityStats($eventId, $user): array
    {
        $query = Group::query();

        if (!$user->isAdmin() && !$user->isQA() && !$user->isQALead()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $query->whereIn('id', $groupIds);
        }

        $groups = $query->with('members')->get();

        $stats = [];
        foreach ($groups as $group) {
            $memberIds = $group->members->pluck('id');

            $parseStats = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
                ->whereIn('editor_id', $memberIds)
                ->selectRaw('parse_status, COUNT(*) as count')
                ->groupBy('parse_status')
                ->pluck('count', 'parse_status')
                ->toArray();

            $total = array_sum($parseStats);
            if ($total === 0) continue;

            $valid = $parseStats['valid'] ?? 0;
            $warnings = $parseStats['warning'] ?? 0;
            $errors = $parseStats['error'] ?? 0;
            $errorRate = round((($warnings + $errors) / $total) * 100, 2);

            $stats[] = [
                'group_id' => $group->id,
                'group_code' => $group->group_code,
                'group_name' => $group->name,
                'member_count' => $memberIds->count(),
                'total_files' => $total,
                'valid' => $valid,
                'warnings' => $warnings,
                'errors' => $errors,
                'error_rate' => $errorRate,
                'quality_score' => 100 - $errorRate,
            ];
        }

        usort($stats, fn($a, $b) => $b['error_rate'] <=> $a['error_rate']);

        return $stats;
    }

    /**
     * Get common filename issues
     */
    protected function getCommonFilenameIssues($eventId): array
    {
        // Analyze filenames with errors/warnings
        $problematicMedia = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('parse_status', ['warning', 'error'])
            ->select('original_filename', 'filename', 'parse_status')
            ->limit(500)
            ->get();

        $issues = [
            'wrong_format' => 0,
            'missing_camera_number' => 0,
            'missing_date' => 0,
            'invalid_extension' => 0,
            'special_characters' => 0,
            'too_long' => 0,
            'other' => 0,
        ];

        foreach ($problematicMedia as $media) {
            $filename = $media->original_filename ?? $media->filename;

            // Check for common issues
            if (!preg_match('/^\d{4}-\d{2}-\d{2}/', $filename)) {
                $issues['missing_date']++;
            }
            if (!preg_match('/CAM\d+|C\d+|Camera\d+/i', $filename)) {
                $issues['missing_camera_number']++;
            }
            if (!preg_match('/\.(mp4|mov|avi|mxf|jpg|jpeg|png|raw|cr2|arw)$/i', $filename)) {
                $issues['invalid_extension']++;
            }
            if (preg_match('/[<>:"|?*]/', $filename)) {
                $issues['special_characters']++;
            }
            if (strlen($filename) > 200) {
                $issues['too_long']++;
            }
        }

        // Convert to array format
        $result = [];
        foreach ($issues as $type => $count) {
            if ($count > 0) {
                $result[] = [
                    'issue_type' => $type,
                    'count' => $count,
                    'label' => $this->getIssueLabel($type),
                    'suggestion' => $this->getIssueSuggestion($type),
                ];
            }
        }

        usort($result, fn($a, $b) => $b['count'] <=> $a['count']);

        return $result;
    }

    /**
     * Get daily quality trend
     */
    protected function getDailyQualityTrend($eventId, int $days): array
    {
        $startDate = now()->subDays($days)->startOfDay();

        $daily = Media::when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->where('created_at', '>=', $startDate)
            ->selectRaw('DATE(created_at) as date, parse_status, COUNT(*) as count')
            ->groupBy('date', 'parse_status')
            ->orderBy('date')
            ->get();

        // Group by date
        $trend = [];
        foreach ($daily as $row) {
            if (!isset($trend[$row->date])) {
                $trend[$row->date] = [
                    'date' => $row->date,
                    'valid' => 0,
                    'warning' => 0,
                    'error' => 0,
                    'total' => 0,
                ];
            }
            $trend[$row->date][$row->parse_status] = $row->count;
            $trend[$row->date]['total'] += $row->count;
        }

        // Calculate error rates
        $result = [];
        foreach ($trend as $date => $data) {
            $data['error_rate'] = $data['total'] > 0 
                ? round((($data['warning'] + $data['error']) / $data['total']) * 100, 2) 
                : 0;
            $result[] = $data;
        }

        return $result;
    }

    /**
     * Get editors needing training
     */
    public function needsTraining(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isAdmin() && !$user->isQA() && !$user->isQALead() && !$user->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $eventId = $request->get('event_id');
        $threshold = $request->get('threshold', 10); // Error rate threshold

        $editorStats = $this->getEditorQualityStats($eventId, $user);

        $needsTraining = array_filter($editorStats, fn($e) => $e['error_rate'] > $threshold);

        return response()->json([
            'threshold' => $threshold,
            'editors' => array_values($needsTraining),
            'count' => count($needsTraining),
        ]);
    }

    /**
     * Get quality report for an editor
     */
    public function editorReport(Request $request, int $editorId): JsonResponse
    {
        $user = auth('api')->user();
        $editor = User::findOrFail($editorId);

        // Check authorization
        if (!$user->isAdmin() && !$user->isQA() && !$user->isQALead()) {
            $groupIds = $user->ledGroups()->pluck('id');
            $editorGroupIds = $editor->groups()->pluck('groups.id');
            if ($groupIds->intersect($editorGroupIds)->isEmpty()) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        }

        $eventId = $request->get('event_id');

        // Parse status breakdown
        $parseStats = Media::where('editor_id', $editorId)
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->selectRaw('parse_status, COUNT(*) as count')
            ->groupBy('parse_status')
            ->pluck('count', 'parse_status')
            ->toArray();

        $total = array_sum($parseStats);

        // Recent problematic files
        $recentIssues = Media::where('editor_id', $editorId)
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->whereIn('parse_status', ['warning', 'error'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn($m) => [
                'filename' => $m->filename,
                'original_filename' => $m->original_filename,
                'parse_status' => $m->parse_status,
                'created_at' => $m->created_at,
            ]);

        // Daily trend for this editor
        $dailyTrend = Media::where('editor_id', $editorId)
            ->when($eventId, fn($q) => $q->where('event_id', $eventId))
            ->where('created_at', '>=', now()->subDays(7))
            ->selectRaw('DATE(created_at) as date, parse_status, COUNT(*) as count')
            ->groupBy('date', 'parse_status')
            ->orderBy('date')
            ->get();

        return response()->json([
            'editor' => [
                'id' => $editor->id,
                'name' => $editor->name,
                'email' => $editor->email,
            ],
            'stats' => [
                'total_files' => $total,
                'valid' => $parseStats['valid'] ?? 0,
                'warnings' => $parseStats['warning'] ?? 0,
                'errors' => $parseStats['error'] ?? 0,
                'error_rate' => $total > 0 ? round(((($parseStats['warning'] ?? 0) + ($parseStats['error'] ?? 0)) / $total) * 100, 2) : 0,
            ],
            'recent_issues' => $recentIssues,
            'daily_trend' => $dailyTrend,
        ]);
    }

    protected function getIssueLabel(string $type): string
    {
        return match($type) {
            'wrong_format' => 'Wrong filename format',
            'missing_camera_number' => 'Missing camera number',
            'missing_date' => 'Missing date in filename',
            'invalid_extension' => 'Invalid file extension',
            'special_characters' => 'Special characters in filename',
            'too_long' => 'Filename too long',
            default => 'Other issues',
        };
    }

    protected function getIssueSuggestion(string $type): string
    {
        return match($type) {
            'wrong_format' => 'Use format: YYYY-MM-DD_CAM##_####.ext',
            'missing_camera_number' => 'Include camera number (e.g., CAM01)',
            'missing_date' => 'Start filename with date (YYYY-MM-DD)',
            'invalid_extension' => 'Use standard video/image extensions',
            'special_characters' => 'Avoid special characters: < > : " | ? *',
            'too_long' => 'Keep filename under 200 characters',
            default => 'Review naming conventions',
        };
    }
}
