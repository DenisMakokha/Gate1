<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RateLimitMiddleware
{
    protected RateLimiter $limiter;

    public function __construct(RateLimiter $limiter)
    {
        $this->limiter = $limiter;
    }

    public function handle(Request $request, Closure $next, string $key = 'api', int $maxAttempts = 60, int $decayMinutes = 1): Response
    {
        $identifier = $this->resolveRequestSignature($request, $key);

        if ($this->limiter->tooManyAttempts($identifier, $maxAttempts)) {
            return response()->json([
                'error' => 'Too many requests. Please try again later.',
                'retry_after' => $this->limiter->availableIn($identifier),
            ], 429);
        }

        $this->limiter->hit($identifier, $decayMinutes * 60);

        $response = $next($request);

        return $this->addHeaders(
            $response,
            $maxAttempts,
            $this->calculateRemainingAttempts($identifier, $maxAttempts)
        );
    }

    protected function resolveRequestSignature(Request $request, string $key): string
    {
        $user = $request->user();
        
        if ($user) {
            return $key . ':' . $user->id;
        }

        return $key . ':' . $request->ip();
    }

    protected function calculateRemainingAttempts(string $key, int $maxAttempts): int
    {
        return $this->limiter->remaining($key, $maxAttempts);
    }

    protected function addHeaders(Response $response, int $maxAttempts, int $remainingAttempts): Response
    {
        $response->headers->add([
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => $remainingAttempts,
        ]);

        return $response;
    }
}
