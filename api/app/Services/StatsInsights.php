<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\RequestStatus;
use App\Models\Operation;
use App\Models\ServiceRequest;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use App\Support\StatsPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Štatistika beyond the totals: how the period's paid orders break down (by day, job, car, customer, size and
 * how fast they were paid), how the hours were worked, what is still owed and how the year runs against the last.
 */
final class StatsInsights
{
    private const WEEKDAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];

    private const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];

    /** Order sizes by what the customer paid: lower bound and label. */
    private const SIZES = [[0, 'do 50 €'], [50, '50–100 €'], [100, '100–200 €'], [200, '200–500 €'], [500, 'nad 500 €']];

    /** Days from closing to payment: lower bound and label. */
    private const PAYMENT_DAYS = [[0, 'v ten deň'], [1, '1–3 dni'], [4, '4–7 dní'], [8, '8–14 dní'], [15, '15+ dní']];

    /** Days an unpaid order has waited since closing: lower bound and label. */
    private const OWED_DAYS = [[0, 'do 7 dní'], [8, '8–30 dní'], [31, 'nad 30 dní']];

    /** The heatmap's working-day window: hours 6:00 to 19:59. */
    private const FIRST_HOUR = 6;

    private const LAST_HOUR = 19;

    private const TOP = 8;

    /**
     * @param  Collection<int, WorkOrder>  $paid  orders paid in the period
     * @return array<string, mixed>
     */
    public static function of(StatsPeriod $period, Collection $paid, CarbonImmutable $now): array
    {
        $lines = $paid->map(fn (WorkOrder $o) => ['order' => $o, 'line' => Earnings::line($o, $now)])->values();
        $entries = WorkEntry::query()->with('user')
            ->where('started_at', '>=', $period->start)
            ->where('started_at', '<=', $period->end)
            ->get();

        return [
            'averages' => self::averages($lines),
            'breakdown' => self::breakdown($period, $lines),
            'jobs' => self::jobs($paid, $now),
            'makes' => self::makes($lines),
            'customers' => self::customers($period, $lines),
            'sizes' => self::bands($lines->map(fn (array $l) => (float) $l['line']['billed']), self::SIZES),
            'payment' => self::payment($paid),
            'work' => self::work($entries, $now),
            'owed' => self::owed($now),
            'year' => self::year($period, $now),
            'requests' => self::requests($period),
        ];
    }

    /**
     * @param  Collection<int, array{order: WorkOrder, line: array<string, mixed>}>  $lines
     * @return array{order_billed: float|null, order_earnings: float|null, median_billed: float|null, biggest: array<string, mixed>|null}
     */
    private static function averages(Collection $lines): array
    {
        $billed = $lines->map(fn (array $l) => (float) $l['line']['billed'])->sort()->values();
        $biggest = $lines->sortByDesc(fn (array $l) => $l['line']['billed'])->first();

        return [
            'order_billed' => $billed->isEmpty() ? null : round($billed->avg(), 2),
            'order_earnings' => $lines->isEmpty() ? null : round($lines->avg(fn (array $l) => $l['line']['earnings']), 2),
            'median_billed' => $billed->isEmpty() ? null : round((float) $billed->median(), 2),
            'biggest' => $biggest ? [
                'id' => $biggest['order']->id,
                'number' => $biggest['order']->number,
                'car' => $biggest['line']['car'],
                'customer' => $biggest['line']['customer'],
                'billed' => $biggest['line']['billed'],
                'earnings' => $biggest['line']['earnings'],
            ] : null,
        ];
    }

    /**
     * Zárobok of the period day by day (a week or month) or month by month (a year), by the day the money came in.
     *
     * @param  Collection<int, array{order: WorkOrder, line: array<string, mixed>}>  $lines
     * @return list<array{label: string, title: string, date: string, labor: float, parts_margin: float, earnings: float, orders: int}>
     */
    private static function breakdown(StatsPeriod $period, Collection $lines): array
    {
        $byMonth = $period->kind === 'year';
        $buckets = [];
        for ($d = $period->start; $d->lte($period->end); $d = $byMonth ? $d->addMonth() : $d->addDay()) {
            $buckets[$byMonth ? $d->format('Y-m') : $d->toDateString()] = [
                'label' => $byMonth ? self::MONTHS_SHORT[$d->month - 1] : ($period->kind === 'week' ? self::WEEKDAYS[$d->dayOfWeekIso - 1] : (string) $d->day),
                'title' => $byMonth ? ucfirst(self::MONTHS_SHORT[$d->month - 1])." {$d->year}" : self::WEEKDAYS[$d->dayOfWeekIso - 1]." {$d->day}. {$d->month}.",
                'date' => $d->toDateString(),
                'labor' => 0.0, 'parts_margin' => 0.0, 'earnings' => 0.0, 'orders' => 0,
            ];
        }
        foreach ($lines as ['order' => $order, 'line' => $line]) {
            $paidAt = CarbonImmutable::instance($order->paid_at);
            $key = $byMonth ? $paidAt->format('Y-m') : $paidAt->toDateString();
            if (! isset($buckets[$key])) {
                continue;
            }
            $buckets[$key]['labor'] += $line['labor'];
            $buckets[$key]['parts_margin'] += $line['parts_billed'] - $line['parts_cost'] + $line['parts_adjustment'];
            $buckets[$key]['earnings'] += $line['earnings'];
            $buckets[$key]['orders']++;
        }

        return array_values(array_map(fn (array $b) => [...$b, 'labor' => round($b['labor'], 2), 'parts_margin' => round($b['parts_margin'], 2), 'earnings' => round($b['earnings'], 2)], $buckets));
    }

    /**
     * Labour of the paid orders by job category and the most frequent jobs, each job's labour being its share of the
     * order's (as on the report). Clocked time against the norm says which jobs take longer than planned.
     *
     * @param  Collection<int, WorkOrder>  $paid
     * @return array{categories: list<array{key: string, labor: float, jobs: int}>, top: list<array{name: string, count: int, labor: float, avg_minutes: int|null, norm_minutes: int}>, norm_hours: float, actual_hours: float, efficiency: int|null}
     */
    private static function jobs(Collection $paid, CarbonImmutable $now): array
    {
        $categoryOf = Operation::query()
            ->whereIn('id', $paid->flatMap(fn (WorkOrder $o) => $o->operations->pluck('operation_id'))->filter()->unique()->values())
            ->pluck('category', 'id');

        $categories = [];
        $top = [];
        $norm = 0;
        $actual = 0;
        foreach ($paid as $order) {
            $totals = OrderTotals::compute($order, $now);
            if ($order->operations->isEmpty()) {
                if ($totals['labor'] > 0) {
                    $categories['bez'] ??= ['key' => 'bez', 'labor' => 0.0, 'jobs' => 0];
                    $categories['bez']['labor'] += $totals['labor'];
                    $categories['bez']['jobs']++;
                }

                continue;
            }
            $split = LaborSplit::seconds($order, $now)['by_op'];
            $amounts = LaborSplit::amounts($order, $totals, $split);
            $norm += $order->operations->sum('norm_minutes') * 60;
            $actual += $totals['seconds'];
            foreach ($order->operations as $op) {
                $category = (string) ($categoryOf[$op->operation_id] ?? 'ine');
                $categories[$category] ??= ['key' => $category, 'labor' => 0.0, 'jobs' => 0];
                $categories[$category]['labor'] += $amounts[$op->id] ?? 0;
                $categories[$category]['jobs']++;

                $key = $op->operation_id ? "op{$op->operation_id}" : 'name:'.mb_strtolower(trim($op->name));
                $top[$key] ??= ['name' => $op->name, 'count' => 0, 'labor' => 0.0, 'seconds' => 0, 'norm' => 0];
                $top[$key]['count']++;
                $top[$key]['labor'] += $amounts[$op->id] ?? 0;
                $top[$key]['seconds'] += $split[$op->id] ?? 0;
                $top[$key]['norm'] += $op->norm_minutes;
            }
        }

        $categories = collect($categories)->map(fn (array $c) => [...$c, 'labor' => round($c['labor'], 2)])
            ->sortByDesc('labor')->values()->all();
        $top = collect($top)->sortBy([['count', 'desc'], ['labor', 'desc']])->take(self::TOP)
            ->map(fn (array $t) => [
                'name' => $t['name'],
                'count' => $t['count'],
                'labor' => round($t['labor'], 2),
                'avg_minutes' => $t['seconds'] > 0 ? (int) round($t['seconds'] / $t['count'] / 60) : null,
                'norm_minutes' => (int) round($t['norm'] / $t['count']),
            ])->values()->all();

        return [
            'categories' => $categories,
            'top' => $top,
            'norm_hours' => round($norm / 3600, 1),
            'actual_hours' => round($actual / 3600, 1),
            'efficiency' => $actual > 0 ? (int) round($norm / $actual * 100) : null,
        ];
    }

    /**
     * @param  Collection<int, array{order: WorkOrder, line: array<string, mixed>}>  $lines
     * @return list<array{make: string, orders: int, earnings: float}>
     */
    private static function makes(Collection $lines): array
    {
        $makes = $lines->groupBy(fn (array $l) => trim((string) $l['order']->car?->make) ?: 'Neuvedená')
            ->map(fn (Collection $g, string $make) => ['make' => $make, 'orders' => $g->count(), 'earnings' => round($g->sum(fn (array $l) => $l['line']['earnings']), 2)])
            ->sortByDesc('earnings')->values();

        return self::folded($makes, 6, fn (Collection $rest) => ['make' => 'Ostatné', 'orders' => $rest->sum('orders'), 'earnings' => round($rest->sum('earnings'), 2)]);
    }

    /**
     * Who brought the zárobok, and how many came for the first time.
     *
     * @param  Collection<int, array{order: WorkOrder, line: array<string, mixed>}>  $lines
     * @return array{count: int, new: int, returning: int, top: list<array{id: int, name: string, orders: int, billed: float, earnings: float}>}
     */
    private static function customers(StatsPeriod $period, Collection $lines): array
    {
        $grouped = $lines->groupBy(fn (array $l) => $l['order']->customer_id);
        $known = WorkOrder::query()
            ->whereIn('customer_id', $grouped->keys())
            ->where('created_at', '<', $period->start)
            ->distinct()->pluck('customer_id')->all();

        $top = $grouped->map(fn (Collection $g) => [
            'id' => (int) $g->first()['order']->customer_id,
            'name' => (string) ($g->first()['order']->customer?->name ?? '—'),
            'orders' => $g->count(),
            'billed' => round($g->sum(fn (array $l) => $l['line']['billed']), 2),
            'earnings' => round($g->sum(fn (array $l) => $l['line']['earnings']), 2),
        ])->sortByDesc('earnings')->take(5)->values()->all();

        $returning = count(array_intersect($grouped->keys()->all(), $known));

        return ['count' => $grouped->count(), 'new' => $grouped->count() - $returning, 'returning' => $returning, 'top' => $top];
    }

    /**
     * How long customers take to pay after the order is closed, and how long an order takes from coming in to closing.
     *
     * @param  Collection<int, WorkOrder>  $paid
     * @return array{avg_days: float|null, bands: list<array{label: string, count: int}>, turnaround_days: float|null}
     */
    private static function payment(Collection $paid): array
    {
        $days = $paid->filter(fn (WorkOrder $o) => $o->closed_at && $o->paid_at)
            ->map(fn (WorkOrder $o) => (int) CarbonImmutable::instance($o->closed_at)->startOfDay()->diffInDays(CarbonImmutable::instance($o->paid_at)->startOfDay()))
            ->map(fn (int $d) => max(0, $d));
        $turnaround = $paid->filter(fn (WorkOrder $o) => $o->received_at && $o->closed_at)
            ->map(fn (WorkOrder $o) => max(0, CarbonImmutable::instance($o->received_at)->diffInHours(CarbonImmutable::instance($o->closed_at)) / 24));

        return [
            'avg_days' => $days->isEmpty() ? null : round($days->avg(), 1),
            'bands' => self::bands($days, self::PAYMENT_DAYS),
            'turnaround_days' => $turnaround->isEmpty() ? null : round($turnaround->avg(), 1),
        ];
    }

    /**
     * Hours clocked in the period: by mechanic, by weekday and as a weekday × hour heatmap (stints split at the hour).
     *
     * @param  Collection<int, WorkEntry>  $entries
     * @return array{hours: float, mechanics: list<array{id: int, name: string, hours: float, orders: int}>, weekdays: list<array{label: string, hours: float}>, heatmap: array{hours: list<int>, rows: list<array{label: string, cells: list<float>}>}}
     */
    private static function work(Collection $entries, CarbonImmutable $now): array
    {
        $weekdays = array_fill(0, 7, 0);
        $cells = array_fill(0, 7, array_fill(0, self::LAST_HOUR - self::FIRST_HOUR + 1, 0));
        $mechanics = [];
        $total = 0;

        foreach ($entries as $entry) {
            $start = CarbonImmutable::instance($entry->started_at);
            $end = CarbonImmutable::instance($entry->ended_at ?? $now);
            // A stopwatch left running overnight is not a night shift: a stint counts at most 16 hours here.
            $end = $end->min($start->addHours(16));
            $seconds = max(0, $end->getTimestamp() - $start->getTimestamp());
            $total += $seconds;
            $mechanics[$entry->user_id] ??= ['id' => $entry->user_id, 'name' => (string) $entry->user?->name, 'seconds' => 0, 'orders' => []];
            $mechanics[$entry->user_id]['seconds'] += $seconds;
            $mechanics[$entry->user_id]['orders'][$entry->work_order_id] = true;

            for ($at = $start; $at->lt($end);) {
                $next = $at->startOfHour()->addHour()->min($end);
                $part = $next->getTimestamp() - $at->getTimestamp();
                $day = $at->dayOfWeekIso - 1;
                $weekdays[$day] += $part;
                if ($at->hour >= self::FIRST_HOUR && $at->hour <= self::LAST_HOUR) {
                    $cells[$day][$at->hour - self::FIRST_HOUR] += $part;
                }
                $at = $next;
            }
        }

        $hours = fn (int|float $s) => round($s / 3600, 1);

        return [
            'hours' => $hours($total),
            'mechanics' => collect($mechanics)
                ->map(fn (array $m) => ['id' => $m['id'], 'name' => $m['name'], 'hours' => $hours($m['seconds']), 'orders' => count($m['orders'])])
                ->sortByDesc('hours')->values()->all(),
            'weekdays' => array_map(fn (int $i) => ['label' => self::WEEKDAYS[$i], 'hours' => $hours($weekdays[$i])], range(0, 6)),
            'heatmap' => [
                'hours' => range(self::FIRST_HOUR, self::LAST_HOUR),
                'rows' => array_map(fn (int $i) => ['label' => self::WEEKDAYS[$i], 'cells' => array_map(fn (int $s) => round($s / 3600, 2), $cells[$i])], range(0, 6)),
            ],
        ];
    }

    /**
     * What customers owe right now (closed, not paid), by how long it has waited.
     *
     * @return array{count: int, total: float, oldest_days: int|null, bands: list<array{label: string, count: int, total: float}>}
     */
    private static function owed(CarbonImmutable $now): array
    {
        $unpaid = WorkOrder::query()->withEverything()->where('status', OrderStatus::Unpaid->value)->get();
        $rows = $unpaid->map(fn (WorkOrder $o) => [
            'days' => $o->closed_at ? (int) CarbonImmutable::instance($o->closed_at)->startOfDay()->diffInDays($now->startOfDay()) : 0,
            'total' => OrderTotals::compute($o, $now)['grand'],
        ]);

        $bands = [];
        foreach (self::OWED_DAYS as $i => [$from, $label]) {
            $to = self::OWED_DAYS[$i + 1][0] ?? PHP_INT_MAX;
            $in = $rows->filter(fn (array $r) => $r['days'] >= $from && $r['days'] < $to);
            $bands[] = ['label' => $label, 'count' => $in->count(), 'total' => round($in->sum('total'), 2)];
        }

        return [
            'count' => $rows->count(),
            'total' => round($rows->sum('total'), 2),
            'oldest_days' => $rows->isEmpty() ? null : (int) $rows->max('days'),
            'bands' => $bands,
        ];
    }

    /**
     * Zárobok of the period's year month by month, added up, next to the year before; months still ahead are null.
     *
     * @return array{label: string, previous_label: string, months: list<string>, current: list<float|null>, previous: list<float>}
     */
    private static function year(StatsPeriod $period, CarbonImmutable $now): array
    {
        $year = $period->start->startOfYear();
        // Two years of orders, loaded with only what their money needs (no photos, diagnostics or cars).
        $orders = WorkOrder::query()->with(['workEntries', 'operations', 'parts'])
            ->where('status', OrderStatus::Done->value)
            ->where('paid_at', '>=', $year->subYear())
            ->where('paid_at', '<=', $year->endOfYear())
            ->get();
        $monthly = ['current' => array_fill(0, 12, 0.0), 'previous' => array_fill(0, 12, 0.0)];
        foreach ($orders as $order) {
            $paidAt = CarbonImmutable::instance($order->paid_at);
            $which = $paidAt->year === $year->year ? 'current' : 'previous';
            $monthly[$which][$paidAt->month - 1] += Earnings::kept(OrderTotals::compute($order, $now));
        }

        $running = fn (array $months) => array_map(fn (int $i) => round(array_sum(array_slice($months, 0, $i + 1)), 2), range(0, 11));
        $current = $running($monthly['current']);
        $lastMonth = $year->year < $now->year ? 12 : ($year->year === $now->year ? $now->month : 0);

        return [
            'label' => (string) $year->year,
            'previous_label' => (string) ($year->year - 1),
            'months' => self::MONTHS_SHORT,
            'current' => array_map(fn (int $i) => $i < $lastMonth ? $current[$i] : null, range(0, 11)),
            'previous' => $running($monthly['previous']),
        ];
    }

    /**
     * Requests sent through the client portal in the period.
     *
     * @return array{count: int, accepted: int, rejected: int, waiting: int}
     */
    private static function requests(StatsPeriod $period): array
    {
        $statuses = ServiceRequest::query()->whereBetween('created_at', [$period->start, $period->end])->pluck('status');

        return [
            'count' => $statuses->count(),
            'accepted' => $statuses->filter(fn ($s) => $s === RequestStatus::Accepted)->count(),
            'rejected' => $statuses->filter(fn ($s) => $s === RequestStatus::Rejected)->count(),
            'waiting' => $statuses->filter(fn ($s) => $s === RequestStatus::New)->count(),
        ];
    }

    /**
     * Counts of values falling into ordered bands (each band from its lower bound up to the next one's).
     *
     * @param  Collection<int, int|float>  $values
     * @param  list<array{0: int, 1: string}>  $bands
     * @return list<array{label: string, count: int}>
     */
    private static function bands(Collection $values, array $bands): array
    {
        return array_map(function (int $i) use ($values, $bands): array {
            [$from, $label] = $bands[$i];
            $to = $bands[$i + 1][0] ?? PHP_INT_MAX;

            return ['label' => $label, 'count' => $values->filter(fn ($v) => $v >= $from && $v < $to)->count()];
        }, array_keys($bands));
    }

    /**
     * The first $keep rows and the rest folded into one "Ostatné" row.
     *
     * @template T of array
     *
     * @param  Collection<int, T>  $rows
     * @param  callable(Collection<int, T>): T  $fold
     * @return list<T>
     */
    private static function folded(Collection $rows, int $keep, callable $fold): array
    {
        if ($rows->count() <= $keep + 1) {
            return $rows->values()->all();
        }

        return [...$rows->take($keep)->values()->all(), $fold($rows->slice($keep))];
    }
}
