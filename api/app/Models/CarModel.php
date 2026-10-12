<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['car_make_id', 'name', 'years'])]
class CarModel extends Model
{
    public function make(): BelongsTo
    {
        return $this->belongsTo(CarMake::class, 'car_make_id');
    }

    public function cars(): HasMany
    {
        return $this->hasMany(Car::class);
    }

    public function engines(): HasMany
    {
        return $this->hasMany(CarEngine::class)->orderBy('name');
    }
}
