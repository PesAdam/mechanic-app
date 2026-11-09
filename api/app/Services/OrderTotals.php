<?php

namespace App\Services;

use App\Enums\PartsPricing;
use App\Models\Part;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Carbon\CarbonInterface;

final class OrderTotals
{
    /**
     * `parts` is what the customer is billed (MOC, stred, NC+10% or NC per the order's parts_pricing);
     * `parts_retail` and `parts_cost` are both kept for the margin.
     * `parts_margin` is what stays with the shop from the parts: billed − NC plus the owner's úprava
     * (`parts_margin_adjustment`, −50 when 50 € of it goes to someone else); the customer's total never sees it.
     * `grand` is the hand-edited total when one is set (zľava), `grand_computed` always the calculated one.
     * `labor` follows the labor_billing setting: measured time, or norm hours when the order has jobs with norms,
     * at the order's own hourly rate (the one set when it came in).
     *
     * @return array{seconds: int, norm_seconds: int, delta_seconds: int|null, labor: float, labor_actual: float, labor_norm: float, labor_billing: string, parts: float, parts_retail: float, parts_cost: float, parts_margin_adjustment: float, parts_margin: float, parts_pricing: string, grand_computed: float, grand: float}
     */
    public static function compute(WorkOrder $order, ?CarbonInterface $now = null, ?string $billing = null): array
    {
        $now ??= now();
        $rate = $order->rate();
        $billing ??= Settings::laborBilling();

        $seconds = (int) $order->workEntries->sum(fn (WorkEntry $e) => $e->seconds($now));
        $normSeconds = (int) $order->operations->sum('norm_minutes') * 60;
        $laborActual = round($seconds / 3600 * $rate, 2);
        $laborNorm = round($normSeconds / 3600 * $rate, 2);
        $byNorm = $billing === 'norm' && $normSeconds > 0;
        $labor = $byNorm ? $laborNorm : $laborActual;

        $used = $order->parts->where('used', true);
        $retail = round((float) $used->sum('price', 0), 2);
        $cost = round((float) $used->sum(fn (Part $p) => $p->cost()), 2);
        $pricing = $order->parts_pricing ?? PartsPricing::Moc;
        $parts = round((float) $used->sum(fn (Part $p) => $p->priceFor($pricing)), 2);
        $adjustment = round((float) ($order->parts_margin_adjustment ?? 0), 2);

        return [
            'seconds' => $seconds,
            'norm_seconds' => $normSeconds,
            'delta_seconds' => $normSeconds > 0 ? $normSeconds - $seconds : null,
            'labor' => $labor,
            'labor_actual' => $laborActual,
            'labor_norm' => $laborNorm,
            'labor_billing' => $byNorm ? 'norm' : 'actual',
            'parts' => $parts,
            'parts_retail' => $retail,
            'parts_cost' => $cost,
            'parts_margin_adjustment' => $adjustment,
            'parts_margin' => round($parts - $cost + $adjustment, 2),
            'parts_pricing' => $pricing->value,
            'grand_computed' => $computed = round($labor + $parts, 2),
            'grand' => $order->total_override !== null ? (float) $order->total_override : $computed,
        ];
    }

    /** A closed order with a hand-edited total keeps its zľava measured against what the order adds up to now. */
    public static function rebase(WorkOrder $order): void
    {
        if (! $order->isClosed() || $order->total_override === null) {
            return;
        }
        $fresh = WorkOrder::query()->withEverything()->findOrFail($order->id);
        $fresh->update(['total_original' => self::compute($fresh)['grand_computed']]);
    }
}
