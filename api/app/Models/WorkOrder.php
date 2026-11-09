<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\PartsPricing;
use App\Services\Settings;
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
#[Fillable(['number', 'customer_id', 'car_id', 'summary', 'report_note', 'lift', 'status', 'parts_pricing', 'total_original', 'total_override', 'parts_margin_adjustment', 'hourly_rate', 'mechanic_id', 'received_at', 'planned_at', 'planned_minutes', 'closed_at', 'paid_at', 'public_token'])]
class WorkOrder extends Model
{
    /** @use HasFactory<WorkOrderFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'parts_pricing' => PartsPricing::class,
            'total_original' => 'decimal:2',
            'total_override' => 'decimal:2',
            'parts_margin_adjustment' => 'decimal:2',
            'hourly_rate' => 'decimal:2',
            'received_at' => 'datetime',
            'planned_at' => 'datetime',
            'planned_minutes' => 'integer',
            'closed_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (WorkOrder $order): void {
            $order->public_token ??= (string) Str::uuid();
            $order->number ??= static::nextNumber();
            // The rate is the one set when the order came in: raising it later leaves older orders' sums alone.
            $order->hourly_rate ??= Settings::rate();
        });

        // Zárobok counts on the day the money came in, so marking paid stamps it and taking it back clears it.
        static::saving(function (WorkOrder $order): void {
            if ($order->isDirty('status')) {
                $order->paid_at = $order->status === OrderStatus::Done ? ($order->paid_at ?? now()) : null;
            }
        });
    }

    /** €/h this order is billed at. */
    public function rate(): float
    {
        return (float) ($this->hourly_rate ?? Settings::rate());
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
        return $query->with(['customer', 'car.carModel.make', 'mechanic', 'parts', 'photos', 'diagnostic.codes', 'workEntries.user', 'operations']);
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
