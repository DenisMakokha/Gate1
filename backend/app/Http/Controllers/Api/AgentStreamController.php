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
    public function wsToken(Request $request): JsonResponse
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

        $secret = (string) env('STREAM_TUNNEL_SIGNING_SECRET', '');
        if ($secret === '') {
            return response()->json(['error' => 'Tunnel signing secret not configured'], 500);
        }

        $payload = [
            'agent_id' => $agent->agent_id,
            'device_id' => $agent->device_id,
            'exp' => now()->addSeconds(60)->getTimestamp(),
            'nonce' => (string) Str::uuid(),
        ];

        $payloadB64 = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');
        $sig = hash_hmac('sha256', $payloadB64, $secret);

        return response()->json([
            'token' => $payloadB64 . '.' . $sig,
            'exp' => $payload['exp'],
        ]);
    }

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

        $cache = Cache::store('streaming');

        $queueKey = "stream_queue:editor:{$user->id}";
        $queue = $cache->get($queueKey, []);
        if (!is_array($queue) || count($queue) === 0) {
            return response()->json(['job' => null]);
        }

        // Shift until we find a valid job or queue becomes empty.
        while (count($queue) > 0) {
            $jobId = array_shift($queue);
            $jobKey = "stream_job:{$jobId}";
            $job = $cache->get($jobKey);

            // Persist trimmed queue.
            $cache->put($queueKey, $queue, now()->addMinutes(5));

            if (!$job || !is_array($job)) {
                continue;
            }

            // Ensure this job is for this editor
            if (($job['editor_id'] ?? null) !== $user->id) {
                continue;
            }

            return response()->json(['job' => $job]);
        }

        $cache->put($queueKey, $queue, now()->addMinutes(5));
        return response()->json(['job' => null]);
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

        $cache = Cache::store('streaming');

        $jobKey = "stream_job:{$jobId}";
        $job = $cache->get($jobKey);
        if (!$job || !is_array($job)) {
            return response()->json(['ok' => true]);
        }

        if (($job['editor_id'] ?? null) !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $respKey = "stream_resp:{$jobId}";
        $cache->put($respKey, [
            'job_id' => $jobId,
            'status' => (int) $request->status,
            'headers' => $request->headers ?? [],
            'data_base64' => $request->data_base64,
            'error' => $request->error,
            'at' => now()->toIso8601String(),
        ], now()->addSeconds(30));

        // Best-effort cleanup: job details not needed after a response is recorded.
        $cache->forget($jobKey);

        return response()->json(['ok' => true]);
    }
}
