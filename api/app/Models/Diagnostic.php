<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

#[Fillable(['work_order_id', 'file_name', 'file_path', 'pages', 'imported_at'])]
class Diagnostic extends Model
{
    protected function casts(): array
    {
        return ['pages' => 'integer', 'imported_at' => 'datetime'];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function codes(): HasMany
    {
        return $this->hasMany(DiagCode::class)->orderBy('id');
    }

    public function fileUrl(): ?string
    {
        return $this->file_path ? Storage::disk('public')->url($this->file_path) : null;
    }
}
