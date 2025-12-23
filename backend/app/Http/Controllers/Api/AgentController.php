<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\AuditLog;
use App\Models\SdCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AgentController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'editor_name' => 'required|string|max:255',
            'device_id' => 'required|string|max:255',
            'os' => 'nullable|string|max:100',
            'agent_version' => 'nullable|string|max:50',
            'group_code' => 'nullable|string|exists:groups,group_code',
        ]);

        $user = auth('api')->user();

        $existingAgent = Agent::where('device_id', $request->device_id)->first();
        if ($existingAgent) {
            if ($existingAgent->user_id !== $user->id) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Device already registered to another user',
                ], 409);
            }
            
            $existingAgent->update([
                'os' => $request->os,
                'agent_version' => $request->agent_version,
                'status' => 'active',
                'last_seen_at' => now(),
            ]);

            return response()->json([
                'status' => 'verified',
                'agent_id' => $existingAgent->agent_id,
                'sync_mode' => $existingAgent->sync_mode,
                'settings' => $this->getAgentSettings(),
            ]);
        }

        $agent = Agent::create([
            'agent_id' => 'EDT-' . str_pad(Agent::count() + 1, 3, '0', STR_PAD_LEFT),
            'user_id' => $user->id,
            'device_id' => $request->device_id,
            'device_name' => $request->editor_name,
            'os' => $request->os,
            'agent_version' => $request->agent_version,
            'token' => Str::random(64),
            'status' => 'active',
            'sync_mode' => 'metadata_only',
            'last_seen_at' => now(),
        ]);

        AuditLog::log('agent.register', $user, 'Agent', $agent->id);

        return response()->json([
            'status' => 'verified',
            'agent_id' => $agent->agent_id,
            'sync_mode' => $agent->sync_mode,
            'settings' => $this->getAgentSettings(),
        ], 201);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $request->validate([
            'agent_id' => 'required|string|exists:agents,agent_id',
            'device_id' => 'required|string',
            'status' => 'required|in:online,offline',
            'latency_ms' => 'nullable|integer',
            'watched_folders' => 'nullable|array',
        ]);

        $agent = Agent::where('agent_id', $request->agent_id)
            ->where('device_id', $request->device_id)
            ->first();

        if (!$agent) {
            return response()->json(['status' => 'error', 'message' => 'Agent not found'], 404);
        }

        $agent->update([
            'latency_ms' => $request->latency_ms,
            'watched_folders' => $request->watched_folders,
            'last_seen_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function config(Request $request): JsonResponse
    {
        $request->validate([
            'agent_id' => 'required|string|exists:agents,agent_id',
        ]);

        $agent = Agent::where('agent_id', $request->agent_id)->first();

        return response()->json([
            'sync_mode' => $agent->sync_mode,
            'auto_rename' => false,
            'bandwidth_limit_mbps' => 2,
            'filename_rules' => [
                'format' => 'FULLNAME_AGE_CONDITION_REGION',
                'required_fields' => ['name', 'age', 'condition', 'region'],
                'separator' => '_',
            ],
        ]);
    }

    public function bindSdCard(Request $request): JsonResponse
    {
        $request->validate([
            'hardware_id' => 'required|string',
            'fs_uuid' => 'nullable|string',
            'camera_number' => 'required|integer|min:1',
            'sd_label' => 'required|string|max:10',
            'capacity_bytes' => 'nullable|integer',
        ]);

        $sdCard = SdCard::updateOrCreate(
            ['hardware_id' => $request->hardware_id],
            [
                'fs_uuid' => $request->fs_uuid,
                'camera_number' => $request->camera_number,
                'sd_label' => strtoupper($request->sd_label),
                'capacity_bytes' => $request->capacity_bytes,
                'status' => 'active',
                'last_used_at' => now(),
            ]
        );

        AuditLog::log('sd_card.bind', auth('api')->user(), 'SdCard', $sdCard->id);

        return response()->json([
            'status' => 'bound',
            'sd_card_id' => $sdCard->id,
            'display_label' => $sdCard->display_label,
        ]);
    }

    public function getSdCard(Request $request): JsonResponse
    {
        $request->validate([
            'hardware_id' => 'required|string',
        ]);

        $sdCard = SdCard::where('hardware_id', $request->hardware_id)->first();

        if (!$sdCard) {
            return response()->json([
                'status' => 'not_found',
                'message' => 'SD card not registered',
            ], 404);
        }

        return response()->json([
            'status' => 'found',
            'sd_card' => [
                'id' => $sdCard->id,
                'camera_number' => $sdCard->camera_number,
                'sd_label' => $sdCard->sd_label,
                'display_label' => $sdCard->display_label,
                'last_used_at' => $sdCard->last_used_at,
            ],
        ]);
    }

    private function getAgentSettings(): array
    {
        return [
            'expected_filename_format' => 'FULLNAME_AGE_CONDITION_REGION',
            'allowed_extensions' => ['mp4', 'mov', 'avi', 'mkv'],
            'max_file_size_gb' => 10,
        ];
    }
}
