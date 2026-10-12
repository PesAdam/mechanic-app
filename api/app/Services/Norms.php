<?php

namespace App\Services;

use App\Models\Car;
use App\Models\Operation;
use App\Models\OperationNorm;

/** Picks the most specific norm for a job on a given car: engine → model → make → the job's default. */
final class Norms
{
    /**
     * @param  int|null  $makeId  used when the car carries no model (a make-only lookup)
     * @return array{minutes: int, source: 'engine'|'model'|'make'|'default', norm_id: int|null}
     */
    public static function resolve(Operation $operation, ?Car $car, ?int $makeId = null): array
    {
        $car?->loadMissing('carModel');
        $engineId = $car?->car_engine_id;
        $modelId = $car?->car_model_id;
        $makeId = $car?->carModel?->car_make_id ?? $makeId;

        $base = OperationNorm::query()->where('operation_id', $operation->id);

        if ($engineId && ($n = (clone $base)->where('car_engine_id', $engineId)->first())) {
            return ['minutes' => $n->norm_minutes, 'source' => 'engine', 'norm_id' => $n->id];
        }
        if ($modelId && ($n = (clone $base)->where('car_model_id', $modelId)->whereNull('car_engine_id')->first())) {
            return ['minutes' => $n->norm_minutes, 'source' => 'model', 'norm_id' => $n->id];
        }
        if ($makeId && ($n = (clone $base)->where('car_make_id', $makeId)->whereNull('car_model_id')->whereNull('car_engine_id')->first())) {
            return ['minutes' => $n->norm_minutes, 'source' => 'make', 'norm_id' => $n->id];
        }

        return ['minutes' => $operation->norm_minutes, 'source' => 'default', 'norm_id' => null];
    }
}
