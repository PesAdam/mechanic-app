<?php

namespace App\Enums;

/** Which part price the customer is billed: retail (MOC) or purchase (NC). */
enum PartsPricing: string
{
    case Moc = 'moc';
    case Nc = 'nc';
}
