<?php

namespace App\Policies;

use App\Models\User;

/** Only the owner manages colleagues' accounts. */
class UserPolicy
{
    public function create(User $actor): bool
    {
        return $actor->isOwner();
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->isOwner();
    }
}
