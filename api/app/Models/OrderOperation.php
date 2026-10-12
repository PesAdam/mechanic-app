<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['work_order_id', 'operation_id', 'name', 'norm_minutes', 'done', 'sort'])]
class OrderOperation extends Model
{
    protected function casts(): array
    {
        return ['norm_minutes' => 'integer', 'done' => 'boolean', 'sort' => 'integer'];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function operation(): BelongsTo
    {
        return $this->belongsTo(Operation::class);
    }
}
