<?php

namespace App\Models;

use Database\Factories\CarFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['customer_id', 'car_model_id', 'car_engine_id', 'make', 'model', 'engine', 'plate', 'vin', 'km'])]
class Car extends Model
{
    /** @use HasFactory<CarFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return ['km' => 'integer'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function carModel(): BelongsTo
    {
        return $this->belongsTo(CarModel::class);
    }

    public function carEngine(): BelongsTo
    {
        return $this->belongsTo(CarEngine::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }
}
