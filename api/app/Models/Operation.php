<?php

namespace App\Models;

use Database\Factories\OperationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A standard job in the catalogue with its norm time in minutes. */
#[Fillable(['name', 'category', 'norm_minutes', 'is_active'])]
class Operation extends Model
{
    /** @use HasFactory<OperationFactory> */
    use HasFactory;

    public const CATEGORIES = ['servis', 'brzdy', 'motor', 'podvozok', 'prevodovka', 'elektro', 'klima', 'diagnostika', 'karoseria', 'ine'];

    protected function casts(): array
    {
        return ['norm_minutes' => 'integer', 'is_active' => 'boolean'];
    }

    public function samples(): HasMany
    {
        return $this->hasMany(OperationSample::class);
    }

    public function norms(): HasMany
    {
        return $this->hasMany(OperationNorm::class)->orderBy('car_make_id')->orderBy('car_model_id')->orderBy('car_engine_id');
    }
}
