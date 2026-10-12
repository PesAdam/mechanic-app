<?php

namespace App\Models;

use App\Enums\PhotoStage;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[Fillable(['work_order_id', 'path', 'label', 'stage', 'taken_at'])]
class Photo extends Model
{
    protected function casts(): array
    {
        return ['stage' => PhotoStage::class, 'taken_at' => 'datetime'];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function url(): ?string
    {
        return $this->path ? Storage::disk('public')->url($this->path) : null;
    }
}
