<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use App\Services\Earnings;
use App\Services\OrderTotals;
use App\Services\Settings;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

/** Prehľad: zárobok, billing, hours and workload for a week, month or year. */
class DashboardController extends Controller
{
    private const MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];

    public function show(Request $request): JsonResponse
    {
        $period = $request->string('period', 'week')->toString();
        abort_unless(in_array($period, ['week', 'month', 'year'], true), 422, 'Neznáme obdobie.');

        $now = CarbonImmutable::now();
        $rate = Settings::rate();

        [$start, $end, $buckets, $bucketOf, $label] = $this->frame($period, $now);

        $entries = WorkEntry::query()
            ->with('user')
            ->where('started_at', '>=', $start)
            ->where('started_at', '<=', $end)
            ->get();

        // Zárobok is money in hand: it counts on the day the customer paid. Fakturované counts on the day the order was closed.
        $paid = Earnings::paidBetween($start, $end);
        $closed = Earnings::closedBetween($start, $end);

        $unpaid = WorkOrder::query()->withEverything()->where('status', OrderStatus::Unpaid->value)->get();

        $bars = array_map(fn (string $l) => ['label' => $l, 'earnings' => 0.0, 'parts' => 0.0], $buckets);
        $seconds = 0;
        $byUser = [];
        $orders = [];

        foreach ($entries as $e) {
            $s = $e->seconds($now);
            $seconds += $s;
            $byUser[$e->user_id] = ($byUser[$e->user_id] ?? 0) + $s;
            $orders[$e->work_order_id] = true;
        }

        foreach ($paid as $o) {
            $i = $bucketOf(CarbonImmutable::instance($o->paid_at));
            if (isset($bars[$i])) {
                $line = Earnings::line($o, $rate, $now);
                $bars[$i]['earnings'] += $line['earnings'];
                $bars[$i]['parts'] += $line['parts_cost'];
            }
        }

        $money = Earnings::of($paid, $rate, $now);
        $billed = Earnings::of($closed, $rate, $now);
        $pending = Earnings::of($closed->where('status', OrderStatus::Unpaid), $rate, $now);
        $withNorms = $closed->filter(fn (WorkOrder $o) => $o->operations->isNotEmpty());
        $normSeconds = (int) $withNorms->sum(fn (WorkOrder $o) => (int) $o->operations->sum('norm_minutes') * 60);
        $actualSeconds = (int) $withNorms->sum(fn (WorkOrder $o) => OrderTotals::compute($o, $rate, $now)['seconds']);
        $due = $unpaid->sum(fn (WorkOrder $o) => OrderTotals::compute($o, $rate, $now)['grand']);

        $mechanics = User::query()->where('is_active', true)->orderBy('name')->get()
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'hours' => round(($byUser[$u->id] ?? 0) / 3600, 1)])
            ->values();

        $hours = $seconds / 3600;

        return response()->json([
            'period' => $period,
            'label' => $label,
            'rate' => $rate,
            'kpi' => [
                'earnings' => $money['earnings'],
                'labor' => $money['labor'],
                'parts_cost' => $money['parts_cost'],
                'parts_margin' => $money['parts_margin'],
                'discount' => $money['discount'],
                'orders' => $money['orders'],
                // Closed in the period, money not in yet: becomes zárobok on the day it is paid.
                'pending' => Arr::only($pending, ['labor', 'parts_margin', 'earnings', 'orders']),
                'billed' => $billed['billed'],
                'billed_parts_cost' => $billed['parts_cost'],
                'billed_orders' => $billed['orders'],
                'hours' => round($hours, 1),
                'paid' => $money['billed'],
                'paid_count' => $money['orders'],
                'due' => round($due, 2),
                'due_count' => $unpaid->count(),
                'norm_hours' => round($normSeconds / 3600, 1),
                'efficiency' => $actualSeconds > 0 ? (int) round($normSeconds / $actualSeconds * 100) : null,
            ],
            'bars' => array_map(fn ($b) => ['label' => $b['label'], 'earnings' => round($b['earnings'], 2), 'parts' => round($b['parts'], 2)], $bars),
            'mechanics' => $mechanics,
            'avg_hours_per_order' => count($orders) ? round($hours / count($orders), 1) : 0,
        ]);
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable, 2: list<string>, 3: callable(CarbonImmutable): int, 4: string}
     */
    private function frame(string $period, CarbonImmutable $now): array
    {
        if ($period === 'week') {
            $start = $now->startOfWeek(CarbonImmutable::MONDAY);
            $end = $now->endOfWeek(CarbonImmutable::SUNDAY);
            $span = $start->month === $end->month
                ? "{$start->day}.–{$end->day}. {$end->month}. {$end->year}"
                : "{$start->day}. {$start->month}. – {$end->day}. {$end->month}. {$end->year}";

            return [$start, $end, ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'], fn (CarbonImmutable $d) => $d->dayOfWeekIso - 1, "Týždeň {$start->isoWeek} · $span"];
        }

        if ($period === 'month') {
            $start = $now->startOfMonth();
            $end = $now->endOfMonth();
            $weekStarts = [];
            for ($w = $start->startOfWeek(CarbonImmutable::MONDAY); $w <= $end; $w = $w->addWeek()) {
                $weekStarts[] = $w;
            }
            $labels = array_map(fn (CarbonImmutable $w) => 'T'.$w->isoWeek, $weekStarts);
            $bucketOf = function (CarbonImmutable $d) use ($weekStarts): int {
                $ws = $d->startOfWeek(CarbonImmutable::MONDAY);
                foreach ($weekStarts as $i => $w) {
                    if ($w->isSameDay($ws)) {
                        return $i;
                    }
                }

                return -1;
            };

            return [$start, $end, $labels, $bucketOf, self::MONTHS[$start->month - 1]." {$start->year}"];
        }

        $start = $now->startOfYear();
        $end = $now->endOfYear();

        return [$start, $end, ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], fn (CarbonImmutable $d) => $d->month - 1, "Rok {$start->year}"];
    }
}
