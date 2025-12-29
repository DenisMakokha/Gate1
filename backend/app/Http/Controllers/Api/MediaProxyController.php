<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class MediaProxyController extends Controller
{
    public function proxyStream(Request $request, string $mediaId)
    {
        $user = auth('api')->user();

        $canOperational = $user->hasOperationalAccess();
        $isQa = $user->isQA() || $user->isQALead();
        $isGroupLeader = $user->isGroupLeader();

        if (!$canOperational && !$isQa && !$isGroupLeader) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $media = Media::with(['editor'])->where('media_id', $mediaId)->first();
        if (!$media) {
            return response()->json(['error' => 'Media not found'], 404);
        }

        if (!$media->editor_id) {
            return response()->json(['error' => 'No editor source'], 404);
        }

        // Ensure editor is online recently
        if (!$media->editor || !$media->editor->is_online || !$media->editor->last_seen_at || !$media->editor->last_seen_at->gte(now()->subMinutes(5))) {
            return response()->json(['error' => 'Source offline'], 404);
        }

        // Find an agent for this editor
        $agent = Agent::where('user_id', $media->editor_id)
            ->where('status', 'active')
            ->orderBy('last_seen_at', 'desc')
            ->first();

        if (!$agent) {
            return response()->json(['error' => 'Editor agent offline'], 404);
        }

        $range = $request->header('Range');
        $start = 0;
        $end = null;
        $maxChunk = 2 * 1024 * 1024; // 2MB

        if ($range) {
            if (!preg_match('/bytes=(\d+)-(\d+)?/', $range, $m)) {
                return response()->json(['error' => 'Invalid Range'], 416);
            }
            $start = (int) $m[1];
            if (isset($m[2]) && $m[2] !== '') {
                $end = (int) $m[2];
            }
        }

        if ($end === null || $end < $start || ($end - $start + 1) > $maxChunk) {
            $end = $start + $maxChunk - 1;
        }

        $jobId = (string) Str::uuid();
        $job = [
            'job_id' => $jobId,
            'kind' => 'stream',
            'editor_id' => $media->editor_id,
            'agent_id' => $agent->agent_id,
            'device_id' => $agent->device_id,
            'media_id' => $media->media_id,
            'file_path' => $media->file_path,
            'start' => $start,
            'end' => $end,
            'requested_by' => $user->id,
            'expires_at' => now()->addSeconds(20)->toIso8601String(),
        ];

        Cache::put("stream_job:{$jobId}", $job, now()->addSeconds(20));

        $queueKey = "stream_queue:editor:{$media->editor_id}";
        $queue = Cache::get($queueKey, []);
        if (!is_array($queue)) $queue = [];
        if (!in_array($jobId, $queue, true)) {
            $queue[] = $jobId;
        }
        Cache::put($queueKey, $queue, now()->addMinutes(5));

        $respKey = "stream_resp:{$jobId}";
        $deadline = microtime(true) + 15.0;

        while (microtime(true) < $deadline) {
            $resp = Cache::get($respKey);
            if ($resp && is_array($resp)) {
                $status = (int) ($resp['status'] ?? 500);
                $headers = is_array($resp['headers'] ?? null) ? $resp['headers'] : [];
                $b64 = $resp['data_base64'] ?? null;
                $bytes = $b64 ? base64_decode($b64) : '';

                $r = new Response($bytes, $status);
                foreach ($headers as $k => $v) {
                    $r->headers->set($k, $v);
                }

                // Cleanup response key after consumption.
                Cache::forget($respKey);
                return $r;
            }
            usleep(200000); // 200ms
        }

        return response()->json(['error' => 'Stream timeout'], 504);
    }

    public function proxyDownload(Request $request, string $mediaId)
    {
        $r = $this->proxyStream($request, $mediaId);

        // If proxyStream returned a Response with bytes, add attachment headers.
        if ($r instanceof Response) {
            $r->headers->set('Content-Disposition', 'attachment');
        }

        return $r;
    }
}
