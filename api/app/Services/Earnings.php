<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\WorkOrder;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Money of closed orders, counted on the day they were closed (invoiced):
 * what was billed, what their parts cost the shop, and what stays with it (zárobok).
 */
final class Earnings
{
    /** @return Collection<int, WorkOrder> */
    public static function closedBetween(CarbonInterface $start, CarbonInterface $end): Collection
    {
        return WorkOrder::query()->withEverything()
            ->whereIn('status', [OrderStatus::Unpaid->value, OrderStatus::Done->value])
            ->whereNotNull('closed_at')
            ->where('closed_at', '>=', $start)
            ->where('closed_at', '<=', $end)
            ->orderBy('closed_at')
            ->get();
    }

    /**
     * Zárobok = billed − parts at purchase price; equally labor + parts margin − zľavy.
     *
     * @param  iterable<WorkOrder>  $orders
     * @return array{orders: int, billed: float, labor: float, parts_billed: float, parts_cost: float, parts_margin: float, discount: float, earnings: float, hours: float, per_hour: float|null}
     */
    public static function of(iterable $orders, float $rate, ?CarbonInterface $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $sum = ['orders' => 0, 'billed' => 0.0, 'labor' => 0.0, 'parts_billed' => 0.0, 'parts_cost' => 0.0, 'discount' => 0.0, 'seconds' => 0];

        foreach ($orders as $order) {
            $t = OrderTotals::compute($order, $rate, $now);
            $sum['orders']++;
            $sum['billed'] += $t['grand'];
            $sum['labor'] += $t['labor'];
            $sum['parts_billed'] += $t['parts'];
            $sum['parts_cost'] += $t['parts_cost'];
            $sum['discount'] += $t['grand_computed'] - $t['grand'];
            $sum['seconds'] += $t['seconds'];
        }

        $earnings = $sum['billed'] - $sum['parts_cost'];
        $hours = $sum['seconds'] / 3600;

        return [
            'orders' => $sum['orders'],
            'billed' => round($sum['billed'], 2),
            'labor' => round($sum['labor'], 2),
            'parts_billed' => round($sum['parts_billed'], 2),
            'parts_cost' => round($sum['parts_cost'], 2),
            'parts_margin' => round($sum['parts_billed'] - $sum['parts_cost'], 2),
            'discount' => round($sum['discount'], 2),
            'earnings' => round($earnings, 2),
            'hours' => round($hours, 1),
            'per_hour' => $hours > 0 ? round($earnings / $hours, 2) : null,
        ];
    }

    /**
     * One line per closed order, for the statistics table and the CSV export.
     *
     * @return array{id: int, number: string, closed_at: string|null, status: string, car: string, plate: string|null, customer: string|null, hours: float, labor: float, parts_billed: float, parts_cost: float, discount: float, billed: float, earnings: float}
     */
    public static function line(WorkOrder $order, float $rate, ?CarbonInterface $now = null): array
    {
        $t = OrderTotals::compute($order, $rate, $now ?? CarbonImmutable::now());

        return [
            'id' => $order->id,
            'number' => $order->number,
            'closed_at' => $order->closed_at?->toIso8601String(),
            'status' => $order->status->value,
            'car' => trim(implode(' ', array_filter([$order->car?->make, $order->car?->model, $order->car?->engine]))),
            'plate' => $order->car?->plate,
            'customer' => $order->customer?->name,
            'hours' => round($t['seconds'] / 3600, 2),
            'labor' => $t['labor'],
            'parts_billed' => $t['parts'],
            'parts_cost' => $t['parts_cost'],
            'discount' => round($t['grand_computed'] - $t['grand'], 2),
            'billed' => round($t['grand'], 2),
            'earnings' => round($t['grand'] - $t['parts_cost'], 2),
        ];
    }
}
