<?php

namespace App\Models;

use App\Enums\CodeStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['diagnostic_id', 'code', 'description', 'unit', 'status'])]
class DiagCode extends Model
{
    protected function casts(): array
    {
        return ['status' => CodeStatus::class];
    }

    public function diagnostic(): BelongsTo
    {
        return $this->belongsTo(Diagnostic::class);
    }
}
