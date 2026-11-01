<?php

namespace App\Enums;

/** A client's request: waiting for the shop, turned into a work order, or turned down. */
enum RequestStatus: string
{
    case New = 'new';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
}
