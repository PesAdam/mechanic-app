<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/** A calendar week (Monday–Sunday), month or year, with its neighbours and its counterpart a year earlier. */
final class StatsPeriod
{
    private const MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];

    private const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];

    private function __construct(public readonly string $kind, public readonly CarbonImmutable $start, public readonly CarbonImmutable $end) {}

    public static function containing(string $kind, CarbonImmutable $date): self
    {
        return match ($kind) {
            'week' => new self($kind, $date->startOfWeek(CarbonInterface::MONDAY), $date->endOfWeek(CarbonInterface::SUNDAY)),
            'month' => new self($kind, $date->startOfMonth(), $date->endOfMonth()),
            default => new self('year', $date->startOfYear(), $date->endOfYear()),
        };
    }

    public function previous(): self
    {
        return self::containing($this->kind, $this->start->subDay());
    }

    public function next(): self
    {
        return self::containing($this->kind, $this->end->addDay());
    }

    /** The same ISO week or month a year earlier; for a year simply the previous one. */
    public function yearEarlier(): self
    {
        if ($this->kind === 'week') {
            $year = $this->start->isoWeekYear - 1;
            $week = min($this->start->isoWeek, CarbonImmutable::create($year, 12, 28)->isoWeek);

            return self::containing('week', $this->start->setISODate($year, $week));
        }

        return self::containing($this->kind, $this->start->subYear());
    }

    public function contains(CarbonInterface $moment): bool
    {
        return $moment->between($this->start, $this->end);
    }

    /** E.g. "Týždeň 43 · 19.–25. 10. 2026", "Október 2026", "Rok 2026". */
    public function label(): string
    {
        return match ($this->kind) {
            'week' => "Týždeň {$this->start->isoWeek} · ".($this->start->month === $this->end->month
                ? "{$this->start->day}.–{$this->end->day}. {$this->end->month}. {$this->end->year}"
                : "{$this->start->day}. {$this->start->month}. – {$this->end->day}. {$this->end->month}. {$this->end->year}"),
            'month' => self::MONTHS[$this->start->month - 1]." {$this->start->year}",
            default => "Rok {$this->start->year}",
        };
    }

    /** Axis label of the trend chart: "T43", "okt", "2026". */
    public function short(): string
    {
        return match ($this->kind) {
            'week' => 'T'.$this->start->isoWeek,
            'month' => self::MONTHS_SHORT[$this->start->month - 1],
            default => (string) $this->start->year,
        };
    }
}
