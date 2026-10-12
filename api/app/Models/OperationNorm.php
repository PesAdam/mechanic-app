<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A vehicle-specific norm: for a whole make (car_model_id NULL) or one model. */
#[Fillable(['operation_id', 'car_make_id', 'car_model_id', 'car_engine_id', 'norm_minutes'])]
class OperationNorm extends Model
{
    protected function casts(): array
    {
        return ['norm_minutes' => 'integer'];
    }

    public function operation(): BelongsTo
    {
        return $this->belongsTo(Operation::class);
    }

    public function make(): BelongsTo
    {
        return $this->belongsTo(CarMake::class, 'car_make_id');
    }

    public function model(): BelongsTo
    {
        return $this->belongsTo(CarModel::class, 'car_model_id');
    }

    public function engine(): BelongsTo
    {
        return $this->belongsTo(CarEngine::class, 'car_engine_id');
    }
}
