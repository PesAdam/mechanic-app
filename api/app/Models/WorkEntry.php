<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\WorkEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One stint at a car. `ended_at` NULL means the stopwatch is running; `order_operation_id` ties it to one job of the order. */
#[Fillable(['work_order_id', 'user_id', 'order_operation_id', 'started_at', 'ended_at', 'note', 'manual'])]
class WorkEntry extends Model
{
    /** @use HasFactory<WorkEntryFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['order_operation_id' => 'integer', 'started_at' => 'datetime', 'ended_at' => 'datetime', 'manual' => 'boolean'];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orderOperation(): BelongsTo
    {
        return $this->belongsTo(OrderOperation::class);
    }

    public function isRunning(): bool
    {
        return $this->ended_at === null;
    }

    public function seconds(?CarbonInterface $now = null): int
    {
        $end = $this->ended_at ?? ($now ?? now());

        return max(0, $end->getTimestamp() - $this->started_at->getTimestamp());
    }
}
