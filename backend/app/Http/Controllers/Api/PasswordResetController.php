<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $request->email)->first();
        
        // Generate a simple reset token (in production, use proper token with expiry)
        $token = Str::random(64);
        
        // Store token in cache or database (simplified version)
        cache()->put('password_reset_' . $token, $user->id, now()->addHour());

        // In production, send email with reset link
        // For now, return token for testing
        AuditLog::log('auth.password_reset_requested', null, 'User', $user->id, null, [
            'email' => $request->email,
        ]);

        return response()->json([
            'message' => 'Password reset instructions sent to your email',
            'token' => $token, // Remove in production - only for testing
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $userId = cache()->get('password_reset_' . $request->token);
        
        if (!$userId) {
            return response()->json([
                'error' => 'Invalid or expired reset token',
            ], 422);
        }

        $user = User::find($userId);
        
        if (!$user) {
            return response()->json([
                'error' => 'User not found',
            ], 404);
        }

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        // Invalidate the token
        cache()->forget('password_reset_' . $request->token);

        AuditLog::log('auth.password_reset_completed', null, 'User', $user->id);

        return response()->json([
            'message' => 'Password has been reset successfully',
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = auth('api')->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'error' => 'Current password is incorrect',
            ], 422);
        }

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        AuditLog::log('auth.password_changed', $user, 'User', $user->id);

        return response()->json([
            'message' => 'Password changed successfully',
        ]);
    }
}
