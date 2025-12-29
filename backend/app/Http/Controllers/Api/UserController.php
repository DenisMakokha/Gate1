<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Models\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
        
        if (!$authUser->hasOperationalAccess() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = User::with(['roles', 'groups'])
            ->whereHas('roles', function ($q) {
                $q->where('slug', 'editor');
            });

        // Group leaders can only see editors in their groups
        if ($authUser->isGroupLeader() && !$authUser->hasOperationalAccess()) {
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

    /**
     * Bulk import users from CSV data
     * CSV format: name,email,phone (header row optional)
     */
    public function bulkImport(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->canManageUsers()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'users' => 'required|array|min:1|max:500',
            'users.*.name' => 'required|string|max:255',
            'users.*.email' => 'required|email',
            'users.*.phone' => 'nullable|string|max:20',
            'role' => 'required|string|exists:roles,slug',
            'group_id' => 'nullable|exists:groups,id',
            'send_invitations' => 'boolean',
        ]);

        // Verify user can assign this role
        $manageableRoles = $authUser->getManageableRoles();
        if (!in_array($request->role, $manageableRoles)) {
            return response()->json(['error' => 'You cannot assign this role'], 403);
        }

        $role = Role::where('slug', $request->role)->first();
        $group = $request->group_id ? Group::find($request->group_id) : null;
        $sendInvitations = $request->get('send_invitations', true);

        $results = [
            'created' => [],
            'skipped' => [],
            'errors' => [],
        ];

        DB::beginTransaction();
        try {
            foreach ($request->users as $index => $userData) {
                // Check if email already exists
                if (User::where('email', $userData['email'])->exists()) {
                    $results['skipped'][] = [
                        'row' => $index + 1,
                        'email' => $userData['email'],
                        'reason' => 'Email already exists',
                    ];
                    continue;
                }

                // Generate temporary password or invitation token
                $tempPassword = Str::random(12);
                $invitationToken = $sendInvitations ? Str::random(64) : null;

                $user = User::create([
                    'name' => $userData['name'],
                    'email' => $userData['email'],
                    'phone' => $userData['phone'] ?? null,
                    'password' => Hash::make($tempPassword),
                    'is_active' => true,
                    'invitation_token' => $invitationToken,
                    'invitation_expires_at' => $invitationToken ? now()->addDays(7) : null,
                    'invited_by' => $authUser->id,
                ]);

                $user->roles()->attach($role->id);

                // Assign to group if specified
                if ($group) {
                    $user->groups()->attach($group->id);
                }

                $results['created'][] = [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'temp_password' => $sendInvitations ? null : $tempPassword,
                    'invitation_token' => $invitationToken,
                ];
            }

            DB::commit();

            AuditLog::log('user.bulk_import', $authUser, 'User', null, null, [
                'total_processed' => count($request->users),
                'created' => count($results['created']),
                'skipped' => count($results['skipped']),
                'role' => $request->role,
                'group_id' => $request->group_id,
            ]);

            return response()->json([
                'message' => 'Bulk import completed',
                'results' => $results,
                'summary' => [
                    'total' => count($request->users),
                    'created' => count($results['created']),
                    'skipped' => count($results['skipped']),
                    'errors' => count($results['errors']),
                ],
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Import failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate invitation link for self-registration
     */
    public function createInvitation(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->canManageUsers()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'role' => 'required|string|exists:roles,slug',
            'group_id' => 'nullable|exists:groups,id',
            'max_uses' => 'nullable|integer|min:1|max:500',
            'expires_days' => 'nullable|integer|min:1|max:30',
        ]);

        // Verify user can assign this role
        $manageableRoles = $authUser->getManageableRoles();
        if (!in_array($request->role, $manageableRoles)) {
            return response()->json(['error' => 'You cannot create invitations for this role'], 403);
        }

        $token = Str::random(32);
        $expiresAt = now()->addDays($request->get('expires_days', 7));

        // Store invitation in database
        $invitationId = DB::table('invitations')->insertGetId([
            'token' => $token,
            'role_slug' => $request->role,
            'group_id' => $request->group_id,
            'max_uses' => $request->get('max_uses', 100),
            'uses_count' => 0,
            'created_by' => $authUser->id,
            'expires_at' => $expiresAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        AuditLog::log('invitation.create', $authUser, 'Invitation', $invitationId, null, [
            'role' => $request->role,
            'group_id' => $request->group_id,
            'max_uses' => $request->get('max_uses', 100),
        ]);

        return response()->json([
            'message' => 'Invitation created',
            'invitation' => [
                'id' => $invitationId,
                'token' => $token,
                'role' => $request->role,
                'group_id' => $request->group_id,
                'max_uses' => $request->get('max_uses', 100),
                'expires_at' => $expiresAt->toIso8601String(),
                'link' => config('app.frontend_url', 'http://localhost:5173') . '/register?token=' . $token,
            ],
        ], 201);
    }

    /**
     * List active invitations
     */
    public function listInvitations(): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->canManageUsers()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = DB::table('invitations')
            ->leftJoin('users', 'invitations.created_by', '=', 'users.id')
            ->leftJoin('groups', 'invitations.group_id', '=', 'groups.id')
            ->select(
                'invitations.*',
                'users.name as created_by_name',
                'groups.name as group_name',
                'groups.group_code'
            )
            ->where('invitations.expires_at', '>', now())
            ->whereRaw('invitations.uses_count < invitations.max_uses');

        // Non-admins can only see their own invitations
        if (!$authUser->isAdmin()) {
            $query->where('invitations.created_by', $authUser->id);
        }

        $invitations = $query->orderByDesc('invitations.created_at')->get();

        return response()->json([
            'invitations' => $invitations->map(fn($inv) => [
                'id' => $inv->id,
                'token' => $inv->token,
                'role' => $inv->role_slug,
                'group_id' => $inv->group_id,
                'group_name' => $inv->group_name,
                'group_code' => $inv->group_code,
                'max_uses' => $inv->max_uses,
                'uses_count' => $inv->uses_count,
                'remaining' => $inv->max_uses - $inv->uses_count,
                'created_by' => $inv->created_by_name,
                'expires_at' => $inv->expires_at,
                'link' => config('app.frontend_url', 'http://localhost:5173') . '/register?token=' . $inv->token,
            ]),
        ]);
    }

    /**
     * Revoke/delete an invitation
     */
    public function revokeInvitation(int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->canManageUsers()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $invitation = DB::table('invitations')->where('id', $id)->first();
        
        if (!$invitation) {
            return response()->json(['error' => 'Invitation not found'], 404);
        }

        // Non-admins can only revoke their own invitations
        if (!$authUser->isAdmin() && $invitation->created_by !== $authUser->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        DB::table('invitations')->where('id', $id)->delete();

        AuditLog::log('invitation.revoke', $authUser, 'Invitation', $id, null, []);

        return response()->json(['message' => 'Invitation revoked']);
    }

    /**
     * Download CSV template for bulk import
     */
    public function downloadTemplate(): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="users_import_template.csv"',
        ];

        return response()->stream(function () {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['name', 'email', 'phone']);
            fputcsv($handle, ['John Doe', 'john@example.com', '+1234567890']);
            fputcsv($handle, ['Jane Smith', 'jane@example.com', '']);
            fclose($handle);
        }, 200, $headers);
    }
}
