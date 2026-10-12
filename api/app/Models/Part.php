<?php

namespace App\Models;

use Database\Factories\PartFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['work_order_id', 'name', 'meta', 'price', 'purchase_price', 'used', 'added_at'])]
class Part extends Model
{
    /** @use HasFactory<PartFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'purchase_price' => 'decimal:2', 'used' => 'boolean', 'added_at' => 'datetime'];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    /** Purchase price (NC); a part without one is costed at its retail price. */
    public function cost(): float
    {
        return (float) ($this->purchase_price ?? $this->price);
    }
}
