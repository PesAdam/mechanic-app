<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\PartsPricing;
use Database\Factories\WorkOrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

/** A zákazka. Named WorkOrder because `jobs` belongs to the queue. */
#[Fillable(['number', 'customer_id', 'car_id', 'summary', 'lift', 'status', 'parts_pricing', 'mechanic_id', 'received_at', 'closed_at', 'public_token'])]
class WorkOrder extends Model
{
    /** @use HasFactory<WorkOrderFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'parts_pricing' => PartsPricing::class,
            'received_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (WorkOrder $order): void {
            $order->public_token ??= (string) Str::uuid();
            $order->number ??= static::nextNumber();
        });
    }

    /** Numbers are zero-padded so a plain string MAX() orders them correctly. */
    public static function nextNumber(): string
    {
        $max = (int) (static::query()->max('number') ?? 0);

        return str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    /** @param Builder<WorkOrder> $query */
    public function scopeWithEverything(Builder $query): Builder
    {
        return $query->with(['customer', 'car', 'mechanic', 'parts', 'photos', 'diagnostic.codes', 'workEntries.user', 'operations']);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function car(): BelongsTo
    {
        return $this->belongsTo(Car::class);
    }

    public function mechanic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mechanic_id');
    }

    public function parts(): HasMany
    {
        return $this->hasMany(Part::class)->orderBy('added_at')->orderBy('id');
    }

    public function workEntries(): HasMany
    {
        return $this->hasMany(WorkEntry::class)->orderBy('started_at')->orderBy('id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(Photo::class)->orderBy('taken_at')->orderBy('id');
    }

    public function diagnostic(): HasOne
    {
        return $this->hasOne(Diagnostic::class);
    }

    public function operations(): HasMany
    {
        return $this->hasMany(OrderOperation::class)->orderBy('sort')->orderBy('id');
    }

    public function isClosed(): bool
    {
        return $this->status->isClosed();
    }
}
