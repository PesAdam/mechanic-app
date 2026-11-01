<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/** A one-time registration link. Only the token's hash is stored; the link itself is shown once, when it is made. */
#[Fillable(['token_hash', 'note', 'created_by', 'expires_at', 'used_at', 'client_id', 'revoked_at'])]
class ClientInvite extends Model
{
    public const DAYS_VALID = 7;

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    /** @return array{0: ClientInvite, 1: string} the invite and the plain token for the link */
    public static function issue(?User $by, ?string $note): array
    {
        $token = Str::random(40);
        $invite = static::query()->create([
            'token_hash' => self::hash($token),
            'note' => $note,
            'created_by' => $by?->id,
            'expires_at' => now()->addDays(self::DAYS_VALID),
        ]);

        return [$invite, $token];
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(string $token): ?self
    {
        return static::query()->where('token_hash', self::hash($token))->first();
    }

    /** Not used, not taken back and not expired: the link still registers someone. */
    public function isOpen(): bool
    {
        return $this->used_at === null && $this->revoked_at === null && $this->expires_at->isFuture();
    }

    public function state(): string
    {
        return match (true) {
            $this->used_at !== null => 'used',
            $this->revoked_at !== null => 'revoked',
            $this->expires_at->isPast() => 'expired',
            default => 'open',
        };
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
