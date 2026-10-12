<?php

namespace App\Enums;

enum OrderStatus: string
{
    case New = 'new';
    case Waiting = 'waiting';
    case Open = 'open';
    case Unpaid = 'unpaid';
    case Done = 'done';

    public function isClosed(): bool
    {
        return $this === self::Unpaid || $this === self::Done;
    }
}
