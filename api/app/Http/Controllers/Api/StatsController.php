<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkOrder;
use App\Services\Earnings;
use App\Services\Settings;
use App\Support\StatsPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Štatistika: zárobok of a week, month or year next to the period before, the same one a year earlier and the trend leading up to it. */
class StatsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['week', 'month', 'year'])],
            'date' => ['nullable', 'date'],
        ]);

        $now = CarbonImmutable::now();
        $rate = Settings::rate();
        $current = StatsPeriod::containing($data['period'] ?? 'month', isset($data['date']) ? CarbonImmutable::parse($data['date']) : $now);

        // The trend ends with the chosen period: 12 weeks or months, 5 years.
        $periods = [$current];
        for ($i = 1; $i < ($current->kind === 'year' ? 5 : 12); $i++) {
            array_unshift($periods, $periods[0]->previous());
        }
        // Zárobok is money in hand, so an order belongs to the period it was paid in.
        $orders = Earnings::paidBetween($periods[0]->start, $current->end);
        $within = fn (StatsPeriod $p) => $orders->filter(fn (WorkOrder $o) => $p->contains($o->paid_at));

        $previous = $current->previous();
        $yearEarlier = $current->kind === 'year' ? null : $current->yearEarlier();

        return response()->json([
            'period' => $current->kind,
            'label' => $current->label(),
            'start' => $current->start->toDateString(),
            'end' => $current->end->toDateString(),
            'previous_date' => $previous->start->toDateString(),
            'next_date' => $current->end->lt($now) ? $current->next()->start->toDateString() : null,
            'current' => Earnings::of($within($current), $rate, $now),
            // Closed in the period but not paid yet: it moves into zárobok of the period it gets paid in.
            'pending' => Earnings::of(Earnings::unpaidClosedBetween($current->start, $current->end), $rate, $now),
            'previous' => ['label' => $previous->label()] + Earnings::of($within($previous), $rate, $now),
            'year_earlier' => $yearEarlier
                ? ['label' => $yearEarlier->label()] + Earnings::of(Earnings::paidBetween($yearEarlier->start, $yearEarlier->end), $rate, $now)
                : null,
            'trend' => array_map(fn (StatsPeriod $p) => [
                'label' => $p->short(),
                'title' => $p->label(),
                'date' => $p->start->toDateString(),
            ] + Earnings::of($within($p), $rate, $now), $periods),
            'orders' => $within($current)->map(fn (WorkOrder $o) => Earnings::line($o, $rate, $now))->values(),
        ]);
    }
}
