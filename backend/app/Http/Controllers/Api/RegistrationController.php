<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RegistrationController extends Controller
{
    protected EmailService $emailService;

    public function __construct(EmailService $emailService)
    {
        $this->emailService = $emailService;
    }

    public function register(Request $request): JsonResponse
    {
        // Check if self-registration is allowed
        if (!SystemSetting::get('allow_self_registration', true)) {
            return response()->json([
                'error' => 'Self-registration is currently disabled. Please contact an administrator.',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:20',
            'registration_notes' => 'nullable|string|max:1000',
        ]);

        $requireApproval = SystemSetting::get('require_approval', true);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'registration_notes' => $request->registration_notes,
            'is_active' => !$requireApproval,
            'approval_status' => $requireApproval ? 'pending' : 'approved',
            'approved_at' => $requireApproval ? null : now(),
        ]);

        // If no approval required, assign editor role immediately
        if (!$requireApproval) {
            $editorRole = Role::where('slug', 'editor')->first();
            if ($editorRole) {
                $user->roles()->attach($editorRole->id);
            }
        }

        AuditLog::log('user.self_register', null, 'User', $user->id, null, [
            'email' => $user->email,
            'requires_approval' => $requireApproval,
        ]);

        // Send confirmation email
        if ($requireApproval) {
            $this->emailService->sendRegistrationPending($user->email, $user->name);
        }

        return response()->json([
            'status' => 'success',
            'message' => $requireApproval 
                ? 'Registration submitted successfully. Please wait for admin approval.'
                : 'Registration successful. You can now login.',
            'requires_approval' => $requireApproval,
        ], 201);
    }

    public function registerWithInvitation(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'nullable|email',
            'name' => 'required|string|max:255',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:20',
        ]);

        // 1) Email-based invitation (stored on users table)
        $userInvite = User::where('invitation_token', $request->token)
            ->whereNull('password')
            ->where('invitation_expires_at', '>', now())
            ->first();

        if ($userInvite) {
            $userInvite->update([
                'name' => $request->name,
                'password' => Hash::make($request->password),
                'phone' => $request->phone,
                'is_active' => true,
                'approval_status' => 'approved',
                'approved_at' => now(),
                'invitation_token' => null,
                'invitation_expires_at' => null,
            ]);

            // Assign editor role
            $editorRole = Role::where('slug', 'editor')->first();
            if ($editorRole && !$userInvite->roles()->where('role_id', $editorRole->id)->exists()) {
                $userInvite->roles()->attach($editorRole->id);
            }

            AuditLog::log('user.register_via_invitation', null, 'User', $userInvite->id, null, [
                'invited_by' => $userInvite->invited_by,
                'source' => 'user.invitation_token',
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Registration completed successfully. You can now login.',
            ]);
        }

        // 2) Role/group invitation links (stored in invitations table)
        $invitation = DB::table('invitations')
            ->where('token', $request->token)
            ->where('expires_at', '>', now())
            ->whereRaw('uses_count < max_uses')
            ->first();

        if (!$invitation) {
            return response()->json([
                'error' => 'Invalid or expired invitation token.',
            ], 400);
        }

        if (!$request->filled('email')) {
            return response()->json([
                'error' => 'Email is required for this invitation link.',
            ], 422);
        }

        $request->validate([
            'email' => 'required|email|unique:users,email',
        ]);

        $role = Role::where('slug', $invitation->role_slug)->first();
        if (!$role) {
            return response()->json([
                'error' => 'Invitation role is invalid.',
            ], 400);
        }

        $createdUser = null;

        DB::transaction(function () use ($request, $invitation, $role, &$createdUser) {
            // Lock invitation row to avoid over-using tokens
            $locked = DB::table('invitations')
                ->where('id', $invitation->id)
                ->lockForUpdate()
                ->first();

            if (!$locked || $locked->expires_at <= now() || $locked->uses_count >= $locked->max_uses) {
                throw new \RuntimeException('Invitation is no longer valid.');
            }

            $createdUser = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'phone' => $request->phone,
                'is_active' => true,
                'approval_status' => 'approved',
                'approved_at' => now(),
            ]);

            $createdUser->roles()->attach($role->id);

            if (!empty($locked->group_id)) {
                $createdUser->groups()->attach($locked->group_id);
            }

            DB::table('invitations')
                ->where('id', $locked->id)
                ->update([
                    'uses_count' => DB::raw('uses_count + 1'),
                    'updated_at' => now(),
                ]);
        });

        AuditLog::log('user.register_via_invitation', null, 'User', $createdUser->id, null, [
            'source' => 'invitations_table',
            'invitation_id' => $invitation->id,
            'role' => $invitation->role_slug,
            'group_id' => $invitation->group_id,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Registration completed successfully. You can now login.',
        ]);
    }

    public function sendInvitation(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'email' => 'required|email|unique:users,email',
            'group_id' => 'nullable|exists:groups,id',
        ]);

        // Group leaders can only invite to their own groups
        if ($authUser->isGroupLeader() && !$authUser->isAdmin()) {
            $ledGroupIds = $authUser->ledGroups->pluck('id')->toArray();
            if ($request->group_id && !in_array($request->group_id, $ledGroupIds)) {
                return response()->json(['error' => 'You can only invite users to your own groups'], 403);
            }
        }

        $token = Str::random(64);
        
        $user = User::create([
            'name' => 'Pending',
            'email' => $request->email,
            'password' => null,
            'is_active' => false,
            'approval_status' => 'pending',
            'invitation_token' => $token,
            'invitation_expires_at' => now()->addDays(7),
            'invited_by' => $authUser->id,
        ]);

        // Pre-assign to group if specified
        if ($request->group_id) {
            $user->groups()->attach($request->group_id);
        }

        $inviteUrl = SystemSetting::get('app_url', 'http://localhost:3000') . '/register?token=' . $token;
        $this->emailService->sendInvitation($request->email, $authUser->name, $inviteUrl);

        AuditLog::log('user.send_invitation', $authUser, 'User', $user->id, null, [
            'invited_email' => $request->email,
            'group_id' => $request->group_id,
        ]);

        return response()->json([
            'message' => 'Invitation sent successfully',
            'invitation_url' => $inviteUrl, // For testing, remove in production
        ]);
    }

    public function getPendingRegistrations(Request $request): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = User::where('approval_status', 'pending')
            ->whereNotNull('password') // Exclude invitation-only users
            ->with('groups');

        // Group leaders only see users in their groups or unassigned
        if ($authUser->isGroupLeader() && !$authUser->isAdmin()) {
            $ledGroupIds = $authUser->ledGroups->pluck('id')->toArray();
            $query->where(function ($q) use ($ledGroupIds) {
                $q->whereHas('groups', function ($gq) use ($ledGroupIds) {
                    $gq->whereIn('groups.id', $ledGroupIds);
                })->orWhereDoesntHave('groups');
            });
        }

        $users = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($users);
    }

    public function approveRegistration(Request $request, int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'group_id' => 'required|exists:groups,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = User::findOrFail($id);

        if ($user->approval_status !== 'pending') {
            return response()->json(['error' => 'User is not pending approval'], 400);
        }

        // Group leaders can only approve for their own groups
        if ($authUser->isGroupLeader() && !$authUser->isAdmin()) {
            $ledGroupIds = $authUser->ledGroups->pluck('id')->toArray();
            if (!in_array($request->group_id, $ledGroupIds)) {
                return response()->json(['error' => 'You can only approve users for your own groups'], 403);
            }
        }

        $user->update([
            'is_active' => true,
            'approval_status' => 'approved',
            'approval_notes' => $request->notes,
            'approved_by' => $authUser->id,
            'approved_at' => now(),
        ]);

        // Assign editor role
        $editorRole = Role::where('slug', 'editor')->first();
        if ($editorRole) {
            $user->roles()->syncWithoutDetaching([$editorRole->id]);
        }

        // Assign to group
        $user->groups()->syncWithoutDetaching([$request->group_id]);

        // Get group name for email
        $group = \App\Models\Group::find($request->group_id);

        AuditLog::log('user.approve_registration', $authUser, 'User', $user->id, null, [
            'group_id' => $request->group_id,
        ]);

        // Send approval email
        $this->emailService->sendRegistrationApproved($user->email, $user->name, $group?->name);

        return response()->json([
            'message' => 'User approved successfully',
            'user' => $user->fresh()->load('roles', 'groups'),
        ]);
    }

    public function rejectRegistration(Request $request, int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin() && !$authUser->isGroupLeader()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $user = User::findOrFail($id);

        if ($user->approval_status !== 'pending') {
            return response()->json(['error' => 'User is not pending approval'], 400);
        }

        $user->update([
            'is_active' => false,
            'approval_status' => 'rejected',
            'approval_notes' => $request->reason,
            'approved_by' => $authUser->id,
            'approved_at' => now(),
        ]);

        AuditLog::log('user.reject_registration', $authUser, 'User', $user->id, null, [
            'reason' => $request->reason,
        ]);

        // Send rejection email
        $this->emailService->sendRegistrationRejected($user->email, $user->name, $request->reason);

        return response()->json(['message' => 'Registration rejected']);
    }

    public function suspendUser(Request $request, int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $user = User::findOrFail($id);

        if ($user->id === $authUser->id) {
            return response()->json(['error' => 'Cannot suspend your own account'], 400);
        }

        $user->update([
            'is_active' => false,
            'approval_status' => 'suspended',
            'approval_notes' => $request->reason,
        ]);

        AuditLog::log('user.suspend', $authUser, 'User', $user->id, null, [
            'reason' => $request->reason,
        ]);

        return response()->json(['message' => 'User suspended successfully']);
    }

    public function reactivateUser(int $id): JsonResponse
    {
        $authUser = auth('api')->user();
        
        if (!$authUser->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $user = User::findOrFail($id);

        if (!in_array($user->approval_status, ['suspended', 'rejected'])) {
            return response()->json(['error' => 'User is not suspended or rejected'], 400);
        }

        $user->update([
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        AuditLog::log('user.reactivate', $authUser, 'User', $user->id);

        return response()->json(['message' => 'User reactivated successfully']);
    }

    public function checkInvitation(string $token): JsonResponse
    {
        // 1) Email-based invitation (stored on users table)
        $user = User::where('invitation_token', $token)
            ->where('invitation_expires_at', '>', now())
            ->first();

        if ($user) {
            return response()->json([
                'valid' => true,
                'type' => 'user',
                'email' => $user->email,
                'groups' => $user->groups->map(fn($g) => ['id' => $g->id, 'name' => $g->name]),
            ]);
        }

        // 2) Role/group invitation links (stored in invitations table)
        $invitation = DB::table('invitations')
            ->where('token', $token)
            ->where('expires_at', '>', now())
            ->whereRaw('uses_count < max_uses')
            ->first();

        if (!$invitation) {
            return response()->json([
                'valid' => false,
                'message' => 'Invalid or expired invitation token',
            ], 400);
        }

        return response()->json([
            'valid' => true,
            'type' => 'invitation',
            'email' => null,
            'role' => $invitation->role_slug,
            'group_id' => $invitation->group_id,
            'max_uses' => $invitation->max_uses,
            'uses_count' => $invitation->uses_count,
            'expires_at' => $invitation->expires_at,
        ]);
    }
}
