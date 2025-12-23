<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Issue;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class IssueController extends Controller
{
    public function report(Request $request): JsonResponse
    {
        $request->validate([
            'media_id' => 'required|string|exists:media,media_id',
            'type' => 'required|in:no_audio,low_audio,blurry,shaky,cut_interview,filename_error,duplicate,other',
            'severity' => 'nullable|in:low,medium,high,critical',
            'description' => 'nullable|string|max:1000',
        ]);

        $user = auth('api')->user();
        $media = Media::where('media_id', $request->media_id)->first();

        // Get user's group
        $group = $user->groups()->first();

        $issue = Issue::create([
            'issue_id' => 'ISS-' . Str::random(8),
            'media_id' => $media->id,
            'reported_by' => $user->id,
            'group_id' => $group?->id,
            'type' => $request->type,
            'severity' => $request->severity ?? 'medium',
            'description' => $request->description,
            'status' => 'open',
        ]);

        // Update media status
        $media->update(['status' => 'issue']);

        AuditLog::log('issue.report', $user, 'Issue', $issue->id);

        // TODO: Notify group leader via push notification

        return response()->json([
            'status' => 'reported',
            'issue_id' => $issue->issue_id,
        ], 201);
    }

    public function acknowledge(Request $request, string $issueId): JsonResponse
    {
        $user = auth('api')->user();
        $issue = Issue::where('issue_id', $issueId)->firstOrFail();

        // Only group leaders, QA, or admins can acknowledge
        if (!$user->isAdmin() && !$user->isGroupLeader() && !$user->isQA()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $issue->acknowledge($user);

        AuditLog::log('issue.acknowledge', $user, 'Issue', $issue->id);

        return response()->json([
            'status' => 'acknowledged',
            'issue_id' => $issue->issue_id,
        ]);
    }

    public function resolve(Request $request, string $issueId): JsonResponse
    {
        $request->validate([
            'resolution_notes' => 'nullable|string|max:1000',
        ]);

        $user = auth('api')->user();
        $issue = Issue::where('issue_id', $issueId)->firstOrFail();

        $issue->resolve($user, $request->resolution_notes);

        // Update media status if no more open issues
        $media = $issue->media;
        if (!$media->hasIssues()) {
            $media->update(['status' => 'synced']);
        }

        AuditLog::log('issue.resolve', $user, 'Issue', $issue->id);

        return response()->json([
            'status' => 'resolved',
            'issue_id' => $issue->issue_id,
        ]);
    }

    public function escalate(Request $request, string $issueId): JsonResponse
    {
        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $user = auth('api')->user();
        $issue = Issue::where('issue_id', $issueId)->firstOrFail();

        $issue->update([
            'status' => 'escalated',
        ]);

        AuditLog::log('issue.escalate', $user, 'Issue', $issue->id, null, null, $request->reason);

        // TODO: Notify admin/QA team

        return response()->json([
            'status' => 'escalated',
            'issue_id' => $issue->issue_id,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        $query = Issue::query()->with(['media', 'reporter', 'group']);

        // QA can only see issues, not browse all media
        if ($user->isQA() && !$user->isAdmin()) {
            // QA sees all issues but limited info
            $query->whereIn('status', ['open', 'acknowledged', 'in_progress', 'escalated']);
        } elseif ($user->isGroupLeader() && !$user->isAdmin()) {
            // Group leaders see only their group's issues
            $groupIds = $user->ledGroups()->pluck('id');
            $query->whereIn('group_id', $groupIds);
        } elseif (!$user->isAdmin()) {
            // Editors see only their reported issues
            $query->where('reported_by', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('severity')) {
            $query->where('severity', $request->severity);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        $issues = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json($issues);
    }

    public function show(string $issueId): JsonResponse
    {
        $issue = Issue::where('issue_id', $issueId)
            ->with(['media', 'reporter', 'group', 'assignee', 'resolver'])
            ->firstOrFail();

        $user = auth('api')->user();
        AuditLog::log('issue.view', $user, 'Issue', $issue->id);

        return response()->json($issue);
    }

    public function groupSummary(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        if (!$user->isGroupLeader() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $groupIds = $user->isAdmin() 
            ? Group::pluck('id') 
            : $user->ledGroups()->pluck('id');

        $summary = Group::whereIn('id', $groupIds)
            ->withCount([
                'issues as open_issues' => fn($q) => $q->where('status', 'open'),
                'issues as acknowledged_issues' => fn($q) => $q->where('status', 'acknowledged'),
                'issues as resolved_today' => fn($q) => $q->where('status', 'resolved')
                    ->whereDate('resolved_at', today()),
            ])
            ->get()
            ->map(fn($g) => [
                'group_id' => $g->id,
                'group_code' => $g->group_code,
                'name' => $g->name,
                'open_issues' => $g->open_issues,
                'acknowledged_issues' => $g->acknowledged_issues,
                'resolved_today' => $g->resolved_today,
            ]);

        return response()->json($summary);
    }
}
