<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = AuditLog::with('user');

        if ($request->filled('action')) {
            $query->where('action', 'like', "%{$request->action}%");
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->entity_type);
        }

        if ($request->filled('entity_id')) {
            $query->where('entity_id', $request->entity_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                  ->orWhere('entity_type', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        $logs = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 50));

        return response()->json($logs);
    }

    public function show(int $id): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $log = AuditLog::with('user')->findOrFail($id);

        return response()->json($log);
    }

    public function actions(): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $actions = AuditLog::select('action')
            ->distinct()
            ->orderBy('action')
            ->pluck('action');

        return response()->json($actions);
    }

    public function entityTypes(): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $types = AuditLog::select('entity_type')
            ->whereNotNull('entity_type')
            ->distinct()
            ->orderBy('entity_type')
            ->pluck('entity_type');

        return response()->json($types);
    }

    public function stats(): JsonResponse
    {
        $user = auth('api')->user();
        
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $today = now()->startOfDay();
        $thisWeek = now()->startOfWeek();
        $thisMonth = now()->startOfMonth();

        return response()->json([
            'total' => AuditLog::count(),
            'today' => AuditLog::where('created_at', '>=', $today)->count(),
            'this_week' => AuditLog::where('created_at', '>=', $thisWeek)->count(),
            'this_month' => AuditLog::where('created_at', '>=', $thisMonth)->count(),
            'by_action' => AuditLog::select('action')
                ->selectRaw('count(*) as count')
                ->groupBy('action')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
            'by_user' => AuditLog::with('user:id,name')
                ->select('user_id')
                ->selectRaw('count(*) as count')
                ->groupBy('user_id')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
        ]);
    }
}
