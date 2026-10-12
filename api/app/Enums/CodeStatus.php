<?php

namespace App\Enums;

enum CodeStatus: string
{
    case Open = 'open';
    case Fixed = 'fixed';
    case Watch = 'watch';
}
