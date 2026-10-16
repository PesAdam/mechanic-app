<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Part;
use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use App\Services\OrderTotals;
use App\Services\Settings;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Prehľad: parts spend, hours, billing and workload for a week, month or year. */
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

        $parts = Part::query()
            ->where('used', true)
            ->where('added_at', '>=', $start)
            ->where('added_at', '<=', $end)
            ->get();

        $closed = WorkOrder::query()->withEverything()
            ->whereIn('status', [OrderStatus::Unpaid->value, OrderStatus::Done->value])
            ->whereNotNull('closed_at')
            ->where('closed_at', '>=', $start)
            ->where('closed_at', '<=', $end)
            ->get();

        $unpaid = WorkOrder::query()->withEverything()->where('status', OrderStatus::Unpaid->value)->get();

        $bars = array_map(fn (string $l) => ['label' => $l, 'labor' => 0.0, 'parts' => 0.0], $buckets);
        $seconds = 0;
        $byUser = [];
        $days = [];
        $orders = [];

        foreach ($entries as $e) {
            $s = $e->seconds($now);
            $seconds += $s;
            $byUser[$e->user_id] = ($byUser[$e->user_id] ?? 0) + $s;
            $days[$e->started_at->toDateString()] = true;
            $orders[$e->work_order_id] = true;
            $i = $bucketOf(CarbonImmutable::instance($e->started_at));
            if (isset($bars[$i])) {
                $bars[$i]['labor'] += $s / 3600 * $rate;
            }
        }

        // Prehľad counts parts at purchase price (NC); the invoice uses retail (MOC).
        $partsSum = 0.0;
        $partsRetail = 0.0;
        foreach ($parts as $p) {
            $partsSum += $p->cost();
            $partsRetail += (float) $p->price;
            $i = $bucketOf(CarbonImmutable::instance($p->added_at));
            if (isset($bars[$i])) {
                $bars[$i]['parts'] += $p->cost();
            }
        }

        $billed = $closed->sum(fn (WorkOrder $o) => OrderTotals::compute($o, $rate, $now)['grand']);
        $withNorms = $closed->filter(fn (WorkOrder $o) => $o->operations->isNotEmpty());
        $normSeconds = (int) $withNorms->sum(fn (WorkOrder $o) => (int) $o->operations->sum('norm_minutes') * 60);
        $actualSeconds = (int) $withNorms->sum(fn (WorkOrder $o) => OrderTotals::compute($o, $rate, $now)['seconds']);
        $paid = $closed->where('status', OrderStatus::Done);
        $paidSum = $paid->sum(fn (WorkOrder $o) => OrderTotals::compute($o, $rate, $now)['grand']);
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
                'parts' => round($partsSum, 2),
                'parts_retail' => round($partsRetail, 2),
                'active_days' => count($days),
                'hours' => round($hours, 1),
                'labor' => round($hours * $rate, 2),
                'billed' => round($billed, 2),
                'margin' => $billed > 0 ? (int) round((1 - $partsSum / $billed) * 100) : null,
                'paid' => round($paidSum, 2),
                'paid_count' => $paid->count(),
                'due' => round($due, 2),
                'due_count' => $unpaid->count(),
                'norm_hours' => round($normSeconds / 3600, 1),
                'efficiency' => $actualSeconds > 0 ? (int) round($normSeconds / $actualSeconds * 100) : null,
            ],
            'bars' => array_map(fn ($b) => ['label' => $b['label'], 'labor' => round($b['labor'], 2), 'parts' => round($b['parts'], 2)], $bars),
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
