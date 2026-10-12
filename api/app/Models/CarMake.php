<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

#[Fillable(['name', 'slug', 'logo_url'])]
class CarMake extends Model
{
    public function models(): HasMany
    {
        return $this->hasMany(CarModel::class)->orderBy('name');
    }

    /** Every car of this make, for usage counts. */
    public function cars(): HasManyThrough
    {
        return $this->hasManyThrough(Car::class, CarModel::class);
    }

    public function norms(): HasMany
    {
        return $this->hasMany(OperationNorm::class);
    }
}
