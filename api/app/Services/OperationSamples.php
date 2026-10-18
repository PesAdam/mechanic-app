<?php

namespace App\Services;

use App\Models\OperationSample;
use App\Models\WorkEntry;
use App\Models\WorkOrder;

/**
 * When an order closes, its measured time is attributed to the catalogue jobs and
 * stored as samples for "your average": stints clocked against a job count for that
 * job, and time clocked without a job is split across the jobs in proportion to their norms.
 */
final class OperationSamples
{
    public static function record(WorkOrder $order): void
    {
        $order->loadMissing(['workEntries', 'operations', 'car']);

        OperationSample::query()->where('work_order_id', $order->id)->delete();

        $catalogued = $order->operations->whereNotNull('operation_id');
        $normSum = (int) $order->operations->sum('norm_minutes');

        if ($catalogued->isEmpty() || $normSum <= 0) {
            return;
        }

        $assigned = $order->workEntries
            ->whereNotNull('order_operation_id')
            ->groupBy('order_operation_id')
            ->map(fn ($entries) => (int) $entries->sum(fn (WorkEntry $e) => $e->seconds()));
        $unassigned = (int) $order->workEntries->whereNull('order_operation_id')->sum(fn (WorkEntry $e) => $e->seconds());

        foreach ($catalogued as $op) {
            $actual = (int) round(($assigned[$op->id] ?? 0) + $unassigned * $op->norm_minutes / $normSum);
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
