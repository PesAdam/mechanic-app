<?php

namespace App\Services;

use App\Models\OrderOperation;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Carbon\CarbonInterface;

/**
 * Attributes an order's measured time to its jobs. Stints clocked against a job count
 * for that job. Time clocked without a job goes first to the jobs that have no time of
 * their own (the ones the mechanic forgot to switch to), split by their norms; only when
 * every job already has time is it spread over all of them. Used by the samples that feed
 * "tvoj priemer", by the resource (per-job time and amount) and so by the customer report.
 */
final class LaborSplit
{
    /**
     * @return array{by_op: array<int, int>, unassigned: int} seconds per order_operation id (assigned + share) and the seconds left over when the order has no jobs
     */
    public static function seconds(WorkOrder $order, ?CarbonInterface $now = null): array
    {
        $order->loadMissing(['workEntries', 'operations']);

        $assigned = [];
        $unassigned = 0;
        foreach ($order->workEntries as $entry) {
            /** @var WorkEntry $entry */
            if ($entry->order_operation_id === null) {
                $unassigned += $entry->seconds($now);
            } else {
                $assigned[$entry->order_operation_id] = ($assigned[$entry->order_operation_id] ?? 0) + $entry->seconds($now);
            }
        }

        $ops = $order->operations;
        $byOp = [];
        foreach ($ops as $op) {
            $byOp[$op->id] = $assigned[$op->id] ?? 0;
        }
        if ($ops->isEmpty() || $unassigned <= 0) {
            return ['by_op' => $byOp, 'unassigned' => $ops->isEmpty() ? $unassigned : 0];
        }

        // Jobs without their own time take the forgotten time; once something is ticked off, only ticked jobs are candidates.
        $anyDone = $ops->contains(fn (OrderOperation $op) => $op->done);
        $orphans = $ops->filter(fn (OrderOperation $op) => ($assigned[$op->id] ?? 0) === 0 && (! $anyDone || $op->done));
        // Without such jobs: the ticked ones (never a job nobody did), or all of them while nothing is ticked yet.
        $targets = $orphans->isNotEmpty() ? $orphans : ($anyDone ? $ops->filter(fn (OrderOperation $op) => $op->done) : $ops);
        $normSum = max(1, (int) $targets->sum('norm_minutes'));

        $given = 0;
        $last = null;
        foreach ($targets as $op) {
            $share = (int) round($unassigned * $op->norm_minutes / $normSum);
            $byOp[$op->id] += $share;
            $given += $share;
            $last = $op->id;
        }
        if ($last !== null) {
            $byOp[$last] += $unassigned - $given; // rounding remainder, so the shares add up exactly
        }

        return ['by_op' => $byOp, 'unassigned' => 0];
    }

    /**
     * The labour total spread over the jobs in whole cents (largest remainder), so the prices
     * printed per job add up to "Spolu práca" exactly. Shares follow the norms when billing by
     * norms, the attributed time otherwise.
     *
     * @param  array<string, mixed>  $totals  OrderTotals::compute()
     * @param  array<int, int>  $byOp  seconds()['by_op']
     * @return array<int, float>
     */
    public static function amounts(WorkOrder $order, array $totals, array $byOp): array
    {
        $byNorm = $totals['labor_billing'] === 'norm';
        $basis = [];
        foreach ($order->operations as $op) {
            $basis[$op->id] = $byNorm ? $op->norm_minutes * 60 : ($byOp[$op->id] ?? 0);
        }
        $sum = array_sum($basis);
        $target = (int) round($totals['labor'] * 100);
        if ($sum <= 0 || $target <= 0) {
            return array_map(fn () => 0.0, $basis);
        }

        $exact = array_map(fn ($b) => $b * $target / $sum, $basis);
        $cents = array_map(fn ($v) => (int) floor($v + 1e-9), $exact);
        $remainders = [];
        foreach ($exact as $id => $value) {
            $remainders[$id] = $value - $cents[$id];
        }
        arsort($remainders);
        $left = $target - array_sum($cents);
        foreach (array_keys($remainders) as $id) {
            if ($left <= 0) {
                break;
            }
            $cents[$id]++;
            $left--;
        }

        return array_map(fn ($c) => $c / 100, $cents);
    }
}
