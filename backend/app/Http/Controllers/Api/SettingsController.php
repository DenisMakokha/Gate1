<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $group = $request->get('group');
        
        if ($group) {
            $settings = SystemSetting::where('group', $group)->get();
        } else {
            $settings = SystemSetting::all();
        }

        // Mask encrypted values
        $settings = $settings->map(function ($setting) {
            if ($setting->type === 'encrypted' && $setting->value) {
                $setting->value = '••••••••';
                $setting->is_set = true;
            }
            return $setting;
        });

        return response()->json($settings);
    }

    public function update(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'nullable',
        ]);

        foreach ($request->settings as $item) {
            $setting = SystemSetting::where('key', $item['key'])->first();
            
            if ($setting) {
                // Don't update encrypted fields if they're masked
                if ($setting->type === 'encrypted' && $item['value'] === '••••••••') {
                    continue;
                }
                
                SystemSetting::set($item['key'], $item['value'], $setting->type, $setting->group);
            }
        }

        AuditLog::log('settings.update', $user, 'SystemSetting', null, null, [
            'keys' => collect($request->settings)->pluck('key')->toArray(),
        ]);

        return response()->json(['message' => 'Settings updated successfully']);
    }

    public function getSmtp(): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $settings = SystemSetting::where('group', 'smtp')->get()->keyBy('key');
        
        return response()->json([
            'smtp_host' => $settings['smtp_host']->value ?? '',
            'smtp_port' => (int) ($settings['smtp_port']->value ?? 587),
            'smtp_username' => $settings['smtp_username']->value ?? '',
            'smtp_password' => $settings['smtp_password']->value ? '••••••••' : '',
            'smtp_encryption' => $settings['smtp_encryption']->value ?? 'tls',
            'smtp_from_address' => $settings['smtp_from_address']->value ?? '',
            'smtp_from_name' => $settings['smtp_from_name']->value ?? 'Gate 1 System',
        ]);
    }

    public function updateSmtp(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'smtp_host' => 'required|string',
            'smtp_port' => 'required|integer|min:1|max:65535',
            'smtp_username' => 'nullable|string',
            'smtp_password' => 'nullable|string',
            'smtp_encryption' => 'required|in:tls,ssl,none',
            'smtp_from_address' => 'required|email',
            'smtp_from_name' => 'required|string',
        ]);

        SystemSetting::set('smtp_host', $request->smtp_host);
        SystemSetting::set('smtp_port', $request->smtp_port);
        SystemSetting::set('smtp_username', $request->smtp_username);
        
        // Only update password if not masked
        if ($request->smtp_password && $request->smtp_password !== '••••••••') {
            SystemSetting::set('smtp_password', $request->smtp_password);
        }
        
        SystemSetting::set('smtp_encryption', $request->smtp_encryption);
        SystemSetting::set('smtp_from_address', $request->smtp_from_address);
        SystemSetting::set('smtp_from_name', $request->smtp_from_name);

        AuditLog::log('settings.smtp_update', $user);

        return response()->json(['message' => 'SMTP settings updated successfully']);
    }

    public function testSmtp(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'email' => 'required|email',
        ]);

        $emailService = new EmailService();
        
        // First test connection
        $connectionTest = $emailService->testConnection();
        
        if (!$connectionTest['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Connection failed: ' . $connectionTest['message'],
            ], 400);
        }

        // Send test email
        $sent = $emailService->send(
            $request->email,
            'Test Email - Gate 1 System',
            '<h1>Test Email</h1><p>This is a test email from Gate 1 System. If you received this, your SMTP settings are configured correctly!</p>'
        );

        if ($sent) {
            AuditLog::log('settings.smtp_test', $user, null, null, null, [
                'test_email' => $request->email,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Test email sent successfully to ' . $request->email,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Failed to send test email',
        ], 400);
    }

    public function getGeneral(): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json([
            'app_name' => SystemSetting::get('app_name', 'Gate 1 System'),
            'app_url' => SystemSetting::get('app_url', 'http://localhost:3000'),
            'require_approval' => SystemSetting::get('require_approval', true),
            'allow_self_registration' => SystemSetting::get('allow_self_registration', true),
        ]);
    }

    public function updateGeneral(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'app_name' => 'required|string|max:100',
            'app_url' => 'required|url',
            'require_approval' => 'required|boolean',
            'allow_self_registration' => 'required|boolean',
        ]);

        SystemSetting::set('app_name', $request->app_name);
        SystemSetting::set('app_url', $request->app_url);
        SystemSetting::set('require_approval', $request->require_approval ? 'true' : 'false');
        SystemSetting::set('allow_self_registration', $request->allow_self_registration ? 'true' : 'false');

        AuditLog::log('settings.general_update', $user);

        return response()->json(['message' => 'General settings updated successfully']);
    }
}
