<?php

namespace App\Services;

use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Carbon\CarbonInterface;

/**
 * What the customer's report prints for labour, decided on the server so the page never needs
 * the hourly rate: one row per job (done, billed or clocked) with its price ('price'), its time
 * ('time') or nothing next to it ('total'); an order without jobs gets one row from the stint notes.
 */
final class CustomerReport
{
    /**
     * @param  array<string, mixed>  $totals  OrderTotals::compute()
     * @param  array<int, int>  $byOp  LaborSplit::seconds()['by_op']
     * @param  array<int, float>  $amounts  LaborSplit::amounts()
     * @return array{rows: list<array{label: string, seconds: int|null, amount: float|null}>, period: array{from: string, to: string}|null}
     */
    public static function build(WorkOrder $order, array $totals, array $byOp, array $amounts, string $mode, CarbonInterface $now): array
    {
        $byNorm = $totals['labor_billing'] === 'norm';
        $rows = [];

        if ($order->operations->isNotEmpty()) {
            foreach ($order->operations as $op) {
                $seconds = $byNorm ? $op->norm_minutes * 60 : ($byOp[$op->id] ?? 0);
                if (! $byNorm && ! $op->done && $seconds <= 0) {
                    continue;
                }
                $rows[] = [
                    'label' => $op->name,
                    'seconds' => $mode === 'time' ? $seconds : null,
                    'amount' => $mode === 'price' && ($amounts[$op->id] ?? 0) > 0 ? $amounts[$op->id] : null,
                ];
            }
        } elseif ($order->workEntries->isNotEmpty()) {
            $notes = $order->workEntries->pluck('note')->filter()->unique()->values()->all();
            $rows[] = [
                'label' => $notes ? implode(', ', $notes) : 'Servisné práce',
                'seconds' => $mode === 'time' ? (int) $order->workEntries->sum(fn (WorkEntry $e) => $e->seconds($now)) : null,
                'amount' => $mode === 'price' ? (float) $totals['labor'] : null,
            ];
        }

        return ['rows' => $rows, 'period' => self::period($order, $now)];
    }

    /**
     * "09:40 – 15:05" on the report: the first record of the order to the last one (or now while running).
     *
     * @return array{from: string, to: string}|null
     */
    private static function period(WorkOrder $order, CarbonInterface $now): ?array
    {
        $starts = [];
        $ends = [];
        if ($order->received_at) {
            $starts[] = $order->received_at;
        }
        if ($order->diagnostic) {
            $starts[] = $ends[] = $order->diagnostic->imported_at;
        }
        foreach ($order->photos as $photo) {
            $starts[] = $ends[] = $photo->taken_at;
        }
        foreach ($order->workEntries as $entry) {
            $starts[] = $entry->started_at;
            $ends[] = $entry->ended_at ?? $now;
        }
        if (! $starts) {
            return null;
        }
        $from = min($starts);
        $to = max([$from, ...$ends]);

        return ['from' => $from->toISOString(), 'to' => $to->toISOString()];
    }
}
