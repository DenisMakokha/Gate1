<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

class SystemSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'description',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saved(function () {
            Cache::forget('system_settings');
        });
    }

    public static function get(string $key, $default = null)
    {
        $settings = Cache::remember('system_settings', 3600, function () {
            return static::all()->keyBy('key');
        });

        $setting = $settings->get($key);

        if (!$setting) {
            return $default;
        }

        return static::castValue($setting->value, $setting->type);
    }

    public static function set(string $key, $value, string $type = null, string $group = null): void
    {
        $setting = static::firstOrNew(['key' => $key]);

        if ($type) {
            $setting->type = $type;
        }

        if ($group) {
            $setting->group = $group;
        }

        // Encrypt sensitive values
        if ($setting->type === 'encrypted' && $value) {
            $value = Crypt::encryptString($value);
        }

        $setting->value = is_array($value) ? json_encode($value) : (string) $value;
        $setting->save();
    }

    public static function getGroup(string $group): array
    {
        $settings = static::where('group', $group)->get();
        $result = [];

        foreach ($settings as $setting) {
            $result[$setting->key] = static::castValue($setting->value, $setting->type);
        }

        return $result;
    }

    protected static function castValue($value, string $type)
    {
        if ($value === null || $value === '') {
            return null;
        }

        return match ($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int) $value,
            'json' => json_decode($value, true),
            'encrypted' => self::decryptValue($value),
            default => $value,
        };
    }

    protected static function decryptValue($value)
    {
        try {
            return Crypt::decryptString($value);
        } catch (\Exception $e) {
            return $value; // Return as-is if decryption fails
        }
    }
}
