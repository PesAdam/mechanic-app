<?php

namespace App\Enums;

/** Which part price the customer is billed: retail (MOC), halfway (stred), purchase plus 10 % (NC+10%) or purchase (NC). */
enum PartsPricing: string
{
    case Moc = 'moc';
    case Mid = 'mid';
    case Nc = 'nc';
    case NcPlus10 = 'n10';

    /** One part's price in this mode; a part without an NC is billed at its MOC whichever the mode. */
    public function price(float $retail, ?float $purchase): float
    {
        $cost = $purchase ?? $retail;

        return match ($this) {
            self::Moc => $retail,
            self::Nc => $cost,
            // In whole cents, the half cent away from zero: the same figure the web app shows.
            self::Mid => round((round($retail * 100) + round($cost * 100)) / 2) / 100,
            self::NcPlus10 => $purchase === null ? $retail : round(round($purchase * 100) * 11 / 10) / 100,
        };
    }
}
