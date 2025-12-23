<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = User::with('roles');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->whereHas('roles', function ($q) use ($request) {
                $q->where('slug', $request->role);
            });
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->status === 'active');
        }

        $users = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
            'roles' => 'required|array|min:1',
            'roles.*' => 'exists:roles,slug',
            'is_active' => 'boolean',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'is_active' => $request->get('is_active', true),
        ]);

        $roleIds = Role::whereIn('slug', $request->roles)->pluck('id');
        $user->roles()->attach($roleIds);

        AuditLog::log('user.create', $authUser, 'User', $user->id, null, [
            'created_user' => $user->email,
            'roles' => $request->roles,
        ]);

        return response()->json([
            'message' => 'User created successfully',
            'user' => $user->load('roles'),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && $authUser->id !== $id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $user = User::with(['roles', 'groups', 'ledGroups'])->findOrFail($id);

        return response()->json($user);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && $authUser->id !== $id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $user = User::findOrFail($id);

        $rules = [
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($id)],
            'phone' => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ];

        // Only admin can change roles
        if ($authUser->isAdmin()) {
            $rules['roles'] = 'sometimes|array|min:1';
            $rules['roles.*'] = 'exists:roles,slug';
        }

        // Password change
        if ($request->filled('password')) {
            $rules['password'] = 'string|min:8';
            $rules['current_password'] = $authUser->id === $id ? 'required|string' : 'nullable';
        }

        $request->validate($rules);

        // Verify current password if user is changing their own password
        if ($request->filled('password') && $authUser->id === $id) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json(['error' => 'Current password is incorrect'], 422);
            }
        }

        $updateData = $request->only(['name', 'email', 'phone', 'is_active']);
        
        if ($request->filled('password')) {
            $updateData['password'] = Hash::make($request->password);
        }

        $user->update($updateData);

        // Update roles if provided and user is admin
        if ($authUser->isAdmin() && $request->has('roles')) {
            $roleIds = Role::whereIn('slug', $request->roles)->pluck('id');
            $user->roles()->sync($roleIds);
        }

        AuditLog::log('user.update', $authUser, 'User', $user->id, null, [
            'updated_fields' => array_keys($updateData),
        ]);

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $user->fresh()->load('roles'),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($authUser->id === $id) {
            return response()->json(['error' => 'Cannot delete your own account'], 422);
        }

        $user = User::findOrFail($id);
        $userEmail = $user->email;
        
        $user->delete(); // Soft delete

        AuditLog::log('user.delete', $authUser, 'User', $id, null, [
            'deleted_user' => $userEmail,
        ]);

        return response()->json(['message' => 'User deleted successfully']);
    }

    public function roles(): JsonResponse
    {
        $roles = Role::all();
        return response()->json($roles);
    }

    public function toggleStatus(int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($authUser->id === $id) {
            return response()->json(['error' => 'Cannot deactivate your own account'], 422);
        }

        $user = User::findOrFail($id);
        $user->update(['is_active' => !$user->is_active]);

        AuditLog::log('user.toggle_status', $authUser, 'User', $id, null, [
            'new_status' => $user->is_active ? 'active' : 'inactive',
        ]);

        return response()->json([
            'message' => 'User status updated',
            'is_active' => $user->is_active,
        ]);
    }

    public function assignGroups(Request $request, int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'group_ids' => 'required|array',
            'group_ids.*' => 'exists:groups,id',
        ]);

        $user = User::findOrFail($id);
        $user->groups()->sync($request->group_ids);

        AuditLog::log('user.assign_groups', $authUser, 'User', $id, null, [
            'group_ids' => $request->group_ids,
        ]);

        return response()->json([
            'message' => 'Groups assigned successfully',
            'user' => $user->load('groups'),
        ]);
    }

    /**
     * Update user's online status (heartbeat from desktop agent)
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        $request->validate([
            'activity' => 'nullable|string|max:255',
        ]);

        $user->update([
            'is_online' => true,
            'last_seen_at' => now(),
            'current_activity' => $request->get('activity', 'Active'),
        ]);

        return response()->json([
            'success' => true,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Set user offline (called when desktop agent closes)
     */
    public function setOffline(): JsonResponse
    {
        $user = auth('api')->user();
        
        $user->update([
            'is_online' => false,
            'current_activity' => null,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Get editors with their online status
     * Accessible by admin and group leaders
     */
    public function editorsStatus(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = User::with(['roles', 'groups'])
            ->whereHas('roles', function ($q) {
                $q->where('slug', 'editor');
            });

        // Group leaders can only see editors in their groups
        if ($authUser->isGroupLeader() && !$authUser->isAdmin()) {
            $leaderGroupIds = $authUser->ledGroups()->pluck('id')->toArray();
            $query->whereHas('groups', function ($q) use ($leaderGroupIds) {
                $q->whereIn('groups.id', $leaderGroupIds);
            });
        }

        // Filter by group
        if ($request->filled('group_id')) {
            $query->whereHas('groups', function ($q) use ($request) {
                $q->where('groups.id', $request->group_id);
            });
        }

        // Filter by online status
        if ($request->filled('online')) {
            $isOnline = filter_var($request->online, FILTER_VALIDATE_BOOLEAN);
            if ($isOnline) {
                // Consider online if last seen within 5 minutes
                $query->where('is_online', true)
                    ->where('last_seen_at', '>=', now()->subMinutes(5));
            } else {
                $query->where(function ($q) {
                    $q->where('is_online', false)
                        ->orWhereNull('last_seen_at')
                        ->orWhere('last_seen_at', '<', now()->subMinutes(5));
                });
            }
        }

        $editors = $query->orderByDesc('is_online')
            ->orderByDesc('last_seen_at')
            ->get()
            ->map(function ($editor) {
                // Auto-mark as offline if no heartbeat in 5 minutes
                $isActuallyOnline = $editor->is_online && 
                    $editor->last_seen_at && 
                    $editor->last_seen_at->gte(now()->subMinutes(5));
                
                return [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'email' => $editor->email,
                    'is_online' => $isActuallyOnline,
                    'last_seen_at' => $editor->last_seen_at,
                    'current_activity' => $isActuallyOnline ? $editor->current_activity : null,
                    'groups' => $editor->groups->map(fn($g) => [
                        'id' => $g->id,
                        'name' => $g->name,
                        'group_code' => $g->group_code,
                    ]),
                ];
            });

        $onlineCount = $editors->where('is_online', true)->count();
        $offlineCount = $editors->where('is_online', false)->count();

        return response()->json([
            'editors' => $editors,
            'summary' => [
                'total' => $editors->count(),
                'online' => $onlineCount,
                'offline' => $offlineCount,
            ],
        ]);
    }
}
