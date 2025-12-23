<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = auth('api')->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        if (!$user->hasAnyRole($roles)) {
            return response()->json(['error' => 'Unauthorized. Required roles: ' . implode(', ', $roles)], 403);
        }

        return $next($request);
    }
}
