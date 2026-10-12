<?php

namespace App\Services;

use App\Models\OperationSample;
use App\Models\WorkEntry;
use App\Models\WorkOrder;

/**
 * When an order closes, its measured time is split across the catalogue jobs
 * in proportion to their norms and stored as samples for "your average".
 */
final class OperationSamples
{
    public static function record(WorkOrder $order): void
    {
        $order->loadMissing(['workEntries', 'operations', 'car']);

        OperationSample::query()->where('work_order_id', $order->id)->delete();

        $actual = (int) $order->workEntries->sum(fn (WorkEntry $e) => $e->seconds());
        $ops = $order->operations->whereNotNull('operation_id');
        $normSum = (int) $order->operations->sum('norm_minutes');

        if ($actual <= 0 || $normSum <= 0 || $ops->isEmpty()) {
            return;
        }

        foreach ($ops as $op) {
            OperationSample::query()->create([
                'operation_id' => $op->operation_id,
                'work_order_id' => $order->id,
                'car_model_id' => $order->car?->car_model_id,
                'car_engine_id' => $order->car?->car_engine_id,
                'actual_seconds' => (int) round($actual * $op->norm_minutes / $normSum),
                'norm_minutes' => $op->norm_minutes,
                'recorded_at' => now(),
            ]);
        }
    }
}
