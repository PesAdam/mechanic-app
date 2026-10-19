<?php

namespace App\Services;

use App\Models\OperationSample;
use App\Models\WorkOrder;

/**
 * When an order closes, its measured time is attributed to the catalogue jobs (see LaborSplit)
 * and stored as samples for "your average".
 */
final class OperationSamples
{
    public static function record(WorkOrder $order): void
    {
        $order->loadMissing(['workEntries', 'operations', 'car']);

        OperationSample::query()->where('work_order_id', $order->id)->delete();

        $split = LaborSplit::seconds($order)['by_op'];

        foreach ($order->operations->whereNotNull('operation_id') as $op) {
            $actual = $split[$op->id] ?? 0;
            if ($actual <= 0) {
                continue;
            }

            OperationSample::query()->create([
                'operation_id' => $op->operation_id,
                'work_order_id' => $order->id,
                'car_model_id' => $order->car?->car_model_id,
                'car_engine_id' => $order->car?->car_engine_id,
                'actual_seconds' => $actual,
                'norm_minutes' => $op->norm_minutes,
                'recorded_at' => now(),
            ]);
        }
    }
}
