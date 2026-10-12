<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['operation_id', 'work_order_id', 'actual_seconds', 'norm_minutes', 'recorded_at'])]
class OperationSample extends Model
{
    protected function casts(): array
    {
        return ['actual_seconds' => 'integer', 'norm_minutes' => 'integer', 'recorded_at' => 'datetime'];
    }

    public function operation(): BelongsTo
    {
        return $this->belongsTo(Operation::class);
    }
}
