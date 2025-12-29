<?php

return [
    'default' => env('CACHE_DRIVER', 'file'),

    'stores' => [
        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        'database' => [
            'driver' => 'database',
            'table' => 'cache',
            'connection' => null,
            'lock_connection' => null,
        ],

        'file' => [
            'driver' => 'file',
            'path' => storage_path('framework/cache/data'),
            'lock_path' => storage_path('framework/cache/data'),
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'cache',
            'lock_connection' => 'default',
        ],

        'streaming' => [
            'driver' => env('STREAM_CACHE_DRIVER', 'redis'),
            'connection' => env('STREAM_CACHE_REDIS_CONNECTION', 'cache'),
            'lock_connection' => 'default',
            'prefix' => env('STREAM_CACHE_PREFIX', env('CACHE_PREFIX', 'gate1_cache_') . 'stream_'),
        ],
    ],

    'prefix' => env('CACHE_PREFIX', 'gate1_cache_'),
];
