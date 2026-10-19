<?php

namespace App\Services;

use App\Models\WorkEntry;
use Illuminate\Support\Facades\Cache;

/**
 * A stopwatch nobody paused keeps running overnight; without a scheduler in the
 * container, the board's regular refresh sweeps such stints: anything running longer
 * than a working day is closed at that cap and flagged in its note for the owner to fix.
 */
final class StaleStints
{
    public const MAX_HOURS = 10;

    public const NOTE = 'Stopky nikto nezastavil – auto-ukončené po 10 h, skontrolujte čas';

    /** Runs at most once per few minutes; returns how many stints it closed. */
    public static function sweep(): int
    {
        if (! Cache::add('stale-stints:swept', 1, now()->addMinutes(10))) {
            return 0;
        }

        return self::closeNow();
    }

    public static function closeNow(): int
    {
        $closed = 0;
        $stale = WorkEntry::query()->whereNull('ended_at')->where('started_at', '<', now()->subHours(self::MAX_HOURS))->get();
        foreach ($stale as $entry) {
            $entry->update([
                'ended_at' => $entry->started_at->copy()->addHours(self::MAX_HOURS),
                'note' => trim(($entry->note ? $entry->note.' · ' : '').self::NOTE),
            ]);
            $closed++;
        }

        return $closed;
    }
}
