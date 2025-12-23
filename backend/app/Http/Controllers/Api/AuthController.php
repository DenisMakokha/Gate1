<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated.'],
            ]);
        }

        $token = auth('api')->login($user);

        AuditLog::log('user.login', $user);

        return response()->json([
            'status' => 'success',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->roles->pluck('slug'),
            ],
            'authorization' => [
                'token' => $token,
                'type' => 'bearer',
                'expires_in' => auth('api')->factory()->getTTL() * 60,
            ],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:20',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
        ]);

        AuditLog::log('user.register', $user, 'User', $user->id);

        return response()->json([
            'status' => 'success',
            'message' => 'User registered successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ], 201);
    }

    public function logout(): JsonResponse
    {
        $user = auth('api')->user();
        AuditLog::log('user.logout', $user);
        
        auth('api')->logout();

        return response()->json([
            'status' => 'success',
            'message' => 'Successfully logged out',
        ]);
    }

    public function refresh(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'authorization' => [
                'token' => auth('api')->refresh(),
                'type' => 'bearer',
                'expires_in' => auth('api')->factory()->getTTL() * 60,
            ],
        ]);
    }

    public function me(): JsonResponse
    {
        $user = auth('api')->user();
        $user->load('roles', 'groups', 'ledGroups');

        return response()->json([
            'status' => 'success',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'roles' => $user->roles->pluck('slug'),
                'groups' => $user->groups->map(fn($g) => [
                    'id' => $g->id,
                    'code' => $g->group_code,
                    'name' => $g->name,
                ]),
                'led_groups' => $user->ledGroups->map(fn($g) => [
                    'id' => $g->id,
                    'code' => $g->group_code,
                    'name' => $g->name,
                ]),
            ],
        ]);
    }

    public function updateFcmToken(Request $request): JsonResponse
    {
        $request->validate([
            'fcm_token' => 'required|string',
            'device_type' => 'nullable|in:ios,android',
        ]);

        $user = auth('api')->user();
        $user->update([
            'fcm_token' => $request->fcm_token,
            'device_type' => $request->device_type,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'FCM token updated',
        ]);
    }
}
