<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CameraSession;
use App\Models\Media;
use App\Models\SdCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    public function sync(Request $request): JsonResponse
    {
        $request->validate([
            'agent_id' => 'required|string',
            'device_id' => 'required|string',
            'file.filename' => 'required|string',
            'file.original_path' => 'required|string',
            'file.type' => 'required|in:before,after',
            'file.size_bytes' => 'required|integer',
            'file.checksum' => 'nullable|string',
            'file.created_at' => 'nullable|date',
            'parsed_metadata.full_name' => 'nullable|string',
            'parsed_metadata.age' => 'nullable|integer',
            'parsed_metadata.condition' => 'nullable|string',
            'parsed_metadata.region' => 'nullable|string',
            'event_id' => 'required|exists:events,id',
            'camera_session_id' => 'nullable|exists:camera_sessions,id',
            'camera_number' => 'nullable|integer',
            'sd_card_id' => 'nullable|exists:sd_cards,id',
        ]);

        $user = auth('api')->user();
        $file = $request->input('file');
        $metadata = $request->input('parsed_metadata', []);

        // Check for duplicate
        if ($file['checksum']) {
            $existing = Media::where('checksum', $file['checksum'])->first();
            if ($existing) {
                return response()->json([
                    'status' => 'duplicate',
                    'message' => 'File already indexed',
                    'existing_media_id' => $existing->media_id,
                ], 409);
            }
        }

        // Validate filename and detect issues
        $parseResult = $this->validateFilename($file['filename'], $metadata);

        $media = Media::create([
            'media_id' => 'MED-' . Str::random(8),
            'filename' => $file['filename'],
            'original_filename' => $file['filename'],
            'file_path' => $file['original_path'],
            'checksum' => $file['checksum'],
            'size_bytes' => $file['size_bytes'],
            'type' => $file['type'],
            'full_name' => $metadata['full_name'] ?? null,
            'age' => $metadata['age'] ?? null,
            'condition' => $metadata['condition'] ?? null,
            'region' => $metadata['region'] ?? null,
            'event_id' => $request->event_id,
            'editor_id' => $user->id,
            'camera_session_id' => $request->camera_session_id,
            'camera_number' => $request->camera_number,
            'sd_card_id' => $request->sd_card_id,
            'status' => 'synced',
            'parse_status' => $parseResult['status'],
            'parse_issues' => $parseResult['issues'],
            'device_id' => $request->device_id,
        ]);

        // Update camera session if provided
        if ($request->camera_session_id) {
            CameraSession::where('id', $request->camera_session_id)
                ->increment('files_copied');
        }

        AuditLog::log('media.sync', $user, 'Media', $media->id);

        if ($parseResult['status'] === 'error') {
            return response()->json([
                'status' => 'error',
                'issues' => $parseResult['issues'],
                'media_id' => $media->media_id,
            ]);
        }

        if ($parseResult['status'] === 'warning') {
            return response()->json([
                'status' => 'warning',
                'issues' => $parseResult['issues'],
                'media_id' => $media->media_id,
            ]);
        }

        return response()->json([
            'status' => 'synced',
            'media_id' => $media->media_id,
        ]);
    }

    public function batchSync(Request $request): JsonResponse
    {
        $request->validate([
            'agent_id' => 'required|string',
            'files' => 'required|array|min:1',
            'files.*.filename' => 'required|string',
            'files.*.size_bytes' => 'required|integer',
        ]);

        $synced = 0;
        $warnings = 0;
        $errors = 0;
        $duplicates = 0;

        foreach ($request->files as $fileData) {
            $syncRequest = new Request(array_merge($request->all(), ['file' => $fileData]));
            $response = $this->sync($syncRequest);
            $data = json_decode($response->getContent(), true);

            switch ($data['status']) {
                case 'synced':
                    $synced++;
                    break;
                case 'warning':
                    $warnings++;
                    break;
                case 'error':
                    $errors++;
                    break;
                case 'duplicate':
                    $duplicates++;
                    break;
            }
        }

        return response()->json([
            'synced' => $synced,
            'warnings' => $warnings,
            'errors' => $errors,
            'duplicates' => $duplicates,
        ]);
    }

    public function status(Request $request, string $mediaId): JsonResponse
    {
        $media = Media::where('media_id', $mediaId)->firstOrFail();

        return response()->json([
            'media_id' => $media->media_id,
            'status' => $media->status,
            'parse_status' => $media->parse_status,
            'is_backed_up' => $media->isBackedUp(),
            'has_issues' => $media->hasIssues(),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        // Only admins can do global search
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = Media::query()->with(['editor', 'issues']);

        if ($request->filled('full_name')) {
            $query->where('full_name', 'like', '%' . $request->full_name . '%');
        }

        if ($request->filled('condition')) {
            $query->where('condition', 'like', '%' . $request->condition . '%');
        }

        if ($request->filled('region')) {
            $query->where('region', 'like', '%' . $request->region . '%');
        }

        if ($request->filled('event_id')) {
            $query->where('event_id', $request->event_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('editor_id')) {
            $query->where('editor_id', $request->editor_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $media = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        AuditLog::log('media.search', $user, null, null, null, [
            'filters' => $request->only(['full_name', 'condition', 'region', 'event_id']),
        ]);

        return response()->json($media);
    }

    public function uploadThumbnail(Request $request): JsonResponse
    {
        $request->validate([
            'media_id' => 'required|string|exists:media,media_id',
            'thumbnail_base64' => 'required|string',
        ]);

        $media = Media::where('media_id', $request->media_id)->first();

        // Save thumbnail (in production, save to storage)
        $thumbnailPath = 'thumbnails/' . $media->media_id . '.jpg';
        $media->update(['thumbnail_path' => $thumbnailPath]);

        return response()->json(['status' => 'uploaded']);
    }

    /**
     * Log playback action - audit trail per blueprint
     */
    public function logPlayback(Request $request, string $mediaId): JsonResponse
    {
        $user = auth('api')->user();
        $media = Media::where('media_id', $mediaId)->first();

        if (!$media) {
            return response()->json(['error' => 'Media not found'], 404);
        }

        $request->validate([
            'source' => 'nullable|string',
            'reason' => 'nullable|string',
        ]);

        // Create audit log entry
        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'media_playback',
            'entity_type' => 'media',
            'entity_id' => $media->id,
            'details' => [
                'media_id' => $media->media_id,
                'filename' => $media->filename,
                'source' => $request->input('source', 'unknown'),
                'reason' => $request->input('reason', 'oversight'),
                'user_role' => $user->roles->first()?->name ?? 'unknown',
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['status' => 'logged', 'timestamp' => now()->toIso8601String()]);
    }

    /**
     * Log download action - audit trail per blueprint
     */
    public function logDownload(Request $request, string $mediaId): JsonResponse
    {
        $user = auth('api')->user();
        $media = Media::where('media_id', $mediaId)->first();

        if (!$media) {
            return response()->json(['error' => 'Media not found'], 404);
        }

        // Only Admin and Team Lead can download
        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Download not permitted'], 403);
        }

        // Create audit log entry
        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'media_download',
            'entity_type' => 'media',
            'entity_id' => $media->id,
            'details' => [
                'media_id' => $media->media_id,
                'filename' => $media->filename,
                'source' => $request->input('source', 'unknown'),
                'user_role' => $user->roles->first()?->name ?? 'unknown',
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['status' => 'logged', 'timestamp' => now()->toIso8601String()]);
    }

    /**
     * Get download URL for media - Admin/Team Lead only
     */
    public function getDownloadUrl(string $mediaId): JsonResponse
    {
        $user = auth('api')->user();
        $media = Media::where('media_id', $mediaId)->first();

        if (!$media) {
            return response()->json(['error' => 'Media not found'], 404);
        }

        // Only Admin and Team Lead can download
        if (!$user->hasOperationalAccess()) {
            return response()->json(['error' => 'Download not permitted'], 403);
        }

        // Determine best source for download
        $url = null;
        $source = 'unavailable';

        // Priority 1: Verified backup
        $verifiedBackup = $media->backups()->where('is_verified', true)->first();
        if ($verifiedBackup) {
            $url = $verifiedBackup->download_url ?? $media->file_path;
            $source = 'verified_backup';
        }
        // Priority 2: Editor stream (if online)
        elseif ($media->editor && $media->editor->is_online) {
            $url = $media->file_path; // Would be streamed from editor
            $source = 'editor_stream';
        }

        if (!$url) {
            return response()->json([
                'error' => 'Source offline',
                'message' => 'No download source currently available'
            ], 404);
        }

        return response()->json([
            'url' => $url,
            'source' => $source,
            'filename' => $media->filename,
        ]);
    }

    /**
     * Get playback source info - determines best source per blueprint priority
     */
    public function getPlaybackSource(string $mediaId): JsonResponse
    {
        $user = auth('api')->user();
        $media = Media::with(['backups', 'editor', 'issues'])->where('media_id', $mediaId)->first();

        if (!$media) {
            return response()->json(['error' => 'Media not found'], 404);
        }

        $source = [
            'type' => 'offline',
            'label' => 'Source Offline',
            'url' => null,
            'available' => false,
        ];

        // Priority 1: Verified backup
        $verifiedBackup = $media->backups()->where('is_verified', true)->first();
        if ($verifiedBackup) {
            $source = [
                'type' => 'verified_backup',
                'label' => 'Verified Backup',
                'url' => $verifiedBackup->stream_url ?? $media->preview_url,
                'available' => true,
            ];
        }
        // Priority 2: Editor stream
        elseif ($media->editor && $media->editor->is_online && $media->editor->last_seen_at?->gte(now()->subMinutes(5))) {
            $source = [
                'type' => 'editor_stream',
                'label' => 'Editor Stream (Live)',
                'url' => $media->preview_url,
                'available' => true,
            ];
        }
        // Priority 3: QA cache
        elseif ($media->qa_cache_available) {
            $source = [
                'type' => 'qa_cache',
                'label' => 'QA Review Cache',
                'url' => $media->qa_cache_url,
                'available' => true,
            ];
        }

        return response()->json([
            'source' => $source,
            'media' => [
                'media_id' => $media->media_id,
                'filename' => $media->filename,
                'has_issues' => $media->issues->count() > 0,
                'backup_verified' => $verifiedBackup !== null,
            ],
        ]);
    }

    private function validateFilename(string $filename, array $metadata): array
    {
        $issues = [];
        $status = 'valid';

        // Remove extension
        $name = pathinfo($filename, PATHINFO_FILENAME);

        // Check required fields
        if (empty($metadata['full_name'])) {
            $issues[] = ['field' => 'full_name', 'message' => 'Name is missing or unclear'];
            $status = 'error';
        }

        if (empty($metadata['age'])) {
            $issues[] = ['field' => 'age', 'message' => 'Age is missing'];
            $status = $status === 'error' ? 'error' : 'warning';
        }

        if (empty($metadata['condition'])) {
            $issues[] = ['field' => 'condition', 'message' => 'Condition is missing'];
            $status = 'error';
        }

        if (empty($metadata['region'])) {
            $issues[] = ['field' => 'region', 'message' => 'Region is missing'];
            $status = $status === 'error' ? 'error' : 'warning';
        }

        // Check for spaces (should use underscores)
        if (strpos($name, ' ') !== false) {
            $issues[] = ['field' => 'format', 'message' => 'Use underscores instead of spaces'];
            $status = $status === 'error' ? 'error' : 'warning';
        }

        return [
            'status' => $status,
            'issues' => $issues,
        ];
    }
}
