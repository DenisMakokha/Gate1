<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class AgentStreamController extends Controller
{
    public function poll(Request $request): JsonResponse
    {
        $request->validate([
            'agent_id' => 'required|string|exists:agents,agent_id',
            'device_id' => 'required|string',
        ]);

        $user = auth('api')->user();

        $agent = Agent::where('agent_id', $request->agent_id)
            ->where('device_id', $request->device_id)
            ->where('user_id', $user->id)
            ->first();

        if (!$agent) {
            return response()->json(['error' => 'Agent not found'], 404);
        }

        $queueKey = "stream_queue:editor:{$user->id}";
        $queue = Cache::get($queueKey, []);
        if (!is_array($queue) || count($queue) === 0) {
            return response()->json(['job' => null]);
        }

        $jobId = array_shift($queue);
        Cache::put($queueKey, $queue, now()->addMinutes(5));

        $jobKey = "stream_job:{$jobId}";
        $job = Cache::get($jobKey);
        if (!$job || !is_array($job)) {
            return response()->json(['job' => null]);
        }

        // Ensure this job is for this editor
        if (($job['editor_id'] ?? null) !== $user->id) {
            return response()->json(['job' => null]);
        }

        return response()->json(['job' => $job]);
    }

    public function respond(Request $request): JsonResponse
    {
        $request->validate([
            'job_id' => 'required|string',
            'status' => 'required|integer',
            'headers' => 'nullable|array',
            'data_base64' => 'nullable|string',
            'error' => 'nullable|string',
        ]);

        $user = auth('api')->user();
        $jobId = $request->job_id;

        $jobKey = "stream_job:{$jobId}";
        $job = Cache::get($jobKey);
        if (!$job || !is_array($job)) {
            return response()->json(['ok' => true]);
        }

        if (($job['editor_id'] ?? null) !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $respKey = "stream_resp:{$jobId}";
        Cache::put($respKey, [
            'job_id' => $jobId,
            'status' => (int) $request->status,
            'headers' => $request->headers ?? [],
            'data_base64' => $request->data_base64,
            'error' => $request->error,
            'at' => now()->toIso8601String(),
        ], now()->addSeconds(30));

        return response()->json(['ok' => true]);
    }
}
