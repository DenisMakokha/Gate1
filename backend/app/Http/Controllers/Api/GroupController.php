<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        $query = Group::query()
            ->with(['leader', 'event'])
            ->withCount(['members', 'issues as open_issues' => fn($q) => $q->whereIn('status', ['open', 'acknowledged'])]);

        if ($request->filled('event_id')) {
            $query->where('event_id', $request->event_id);
        }

        if (!$user->isAdmin()) {
            // Group leaders see only their groups
            if ($user->isGroupLeader()) {
                $query->where('leader_id', $user->id);
            } else {
                // Editors see groups they belong to
                $query->whereHas('members', fn($q) => $q->where('user_id', $user->id));
            }
        }

        $groups = $query->orderBy('group_code')->paginate($request->get('per_page', 20));

        return response()->json($groups);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'event_id' => 'required|exists:events,id',
            'leader_id' => 'nullable|exists:users,id',
            'leader_phone' => 'nullable|string|max:20',
        ]);

        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $groupNumber = Group::where('event_id', $request->event_id)->count() + 1;

        $group = Group::create([
            'group_code' => 'G-' . str_pad($groupNumber, 2, '0', STR_PAD_LEFT),
            'name' => $request->name,
            'description' => $request->description,
            'event_id' => $request->event_id,
            'leader_id' => $request->leader_id,
            'leader_phone' => $request->leader_phone,
            'is_active' => true,
        ]);

        // Assign group leader role if leader specified
        if ($request->leader_id) {
            $leader = User::find($request->leader_id);
            if ($leader && !$leader->hasRole('group-leader')) {
                $leaderRole = \App\Models\Role::where('slug', 'group-leader')->first();
                if ($leaderRole) {
                    $leader->roles()->attach($leaderRole->id);
                }
            }
        }

        AuditLog::log('group.create', $user, 'Group', $group->id);

        return response()->json([
            'status' => 'created',
            'group' => $group->load('leader'),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $group = Group::with(['leader', 'members', 'event'])
            ->withCount([
                'members',
                'issues as open_issues' => fn($q) => $q->whereIn('status', ['open', 'acknowledged']),
                'issues as resolved_today' => fn($q) => $q->where('status', 'resolved')->whereDate('resolved_at', today()),
            ])
            ->findOrFail($id);

        return response()->json($group);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'leader_id' => 'nullable|exists:users,id',
            'leader_phone' => 'nullable|string|max:20',
            'is_active' => 'nullable|boolean',
        ]);

        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $group = Group::findOrFail($id);
        $oldValues = $group->toArray();

        $group->update($request->only(['name', 'description', 'leader_id', 'leader_phone', 'is_active']));

        AuditLog::log('group.update', $user, 'Group', $group->id, $oldValues, $group->toArray());

        return response()->json([
            'status' => 'updated',
            'group' => $group->load('leader'),
        ]);
    }

    public function addMember(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $group = Group::findOrFail($id);
        
        if ($group->members()->where('user_id', $request->user_id)->exists()) {
            return response()->json(['error' => 'User already in group'], 409);
        }

        $group->members()->attach($request->user_id);

        AuditLog::log('group.add_member', $user, 'Group', $group->id, null, ['user_id' => $request->user_id]);

        return response()->json(['status' => 'added']);
    }

    public function removeMember(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $user = auth('api')->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $group = Group::findOrFail($id);
        $group->members()->detach($request->user_id);

        AuditLog::log('group.remove_member', $user, 'Group', $group->id, null, ['user_id' => $request->user_id]);

        return response()->json(['status' => 'removed']);
    }

    public function members(int $id): JsonResponse
    {
        $group = Group::findOrFail($id);

        $members = $group->members()
            ->withCount([
                'media as media_today' => fn($q) => $q->whereDate('created_at', today()),
                'reportedIssues as open_issues' => fn($q) => $q->whereIn('status', ['open', 'acknowledged']),
            ])
            ->get()
            ->map(fn($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'email' => $m->email,
                'media_today' => $m->media_today,
                'open_issues' => $m->open_issues,
                'is_online' => $m->agents()->where('status', 'active')
                    ->where('last_seen_at', '>', now()->subMinutes(2))->exists(),
            ]);

        return response()->json(['members' => $members]);
    }

    public function validateGroupCode(Request $request): JsonResponse
    {
        $request->validate([
            'group_code' => 'required|string',
        ]);

        $group = Group::where('group_code', $request->group_code)
            ->with('leader')
            ->first();

        if (!$group) {
            return response()->json([
                'valid' => false,
                'message' => 'Group not found',
            ], 404);
        }

        return response()->json([
            'valid' => true,
            'group' => [
                'id' => $group->id,
                'code' => $group->group_code,
                'name' => $group->name,
                'leader_name' => $group->leader?->name,
            ],
        ]);
    }
}
