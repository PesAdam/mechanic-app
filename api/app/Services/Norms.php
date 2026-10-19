<?php

namespace App\Services;

use App\Models\Car;
use App\Models\Operation;
use App\Models\OperationNorm;
use App\Models\OrderOperation;
use App\Support\VehicleDifficulty;

/** Picks the norm for a job on a given car: the shop's own (engine → model → make), then the job's default scaled to the car. */
final class Norms
{
    /**
     * @param  int|null  $makeId  used when the car carries no model (a make-only lookup)
     * @return array{minutes: int, source: 'engine'|'model'|'make'|'vehicle'|'default', norm_id: int|null}
     */
    public static function resolve(Operation $operation, ?Car $car, ?int $makeId = null): array
    {
        $car?->loadMissing(['carModel.make', 'carEngine']);
        $engineId = $car?->car_engine_id ? (int) $car->car_engine_id : null;
        $modelId = $car?->car_model_id ? (int) $car->car_model_id : null;
        $makeId = $car?->carModel ? (int) $car->carModel->car_make_id : $makeId;

        // The jobs list loads every job's norms up front; a single job asks the database.
        $norms = $operation->relationLoaded('norms') ? $operation->norms : $operation->norms()->get();
        $own = fn (string $source, ?OperationNorm $n) => $n ? ['minutes' => $n->norm_minutes, 'source' => $source, 'norm_id' => $n->id] : null;

        $found = ($engineId ? $own('engine', $norms->first(fn (OperationNorm $n) => (int) $n->car_engine_id === $engineId)) : null)
            ?? ($modelId ? $own('model', $norms->first(fn (OperationNorm $n) => (int) $n->car_model_id === $modelId && $n->car_engine_id === null)) : null)
            ?? ($makeId ? $own('make', $norms->first(fn (OperationNorm $n) => (int) $n->car_make_id === $makeId && $n->car_model_id === null && $n->car_engine_id === null)) : null);
        if ($found !== null) {
            return $found;
        }

        $model = $car?->carModel;
        $factor = $model ? VehicleDifficulty::factor($model->make->name, $model->name, $car->carEngine?->name, $operation->category) : 1.0;
        if ($factor !== 1.0) {
            return ['minutes' => self::scaled($operation->norm_minutes, $factor), 'source' => 'vehicle', 'norm_id' => null];
        }

        return ['minutes' => $operation->norm_minutes, 'source' => 'default', 'norm_id' => null];
    }

    /** A norm corrected on an order becomes the shop's norm for that model (for that engine on engine jobs). */
    public static function remember(OrderOperation $job, ?Car $car, int $minutes): void
    {
        $operation = $job->operation;
        $car?->loadMissing('carModel');
        if ($operation === null || $car?->carModel === null) {
            return;
        }

        $perEngine = $car->car_engine_id && VehicleDifficulty::followsEngine($operation->category);
        OperationNorm::query()->updateOrCreate(
            ['operation_id' => $operation->id, 'car_make_id' => $car->carModel->car_make_id, 'car_model_id' => $car->car_model_id, 'car_engine_id' => $perEngine ? $car->car_engine_id : null],
            ['norm_minutes' => $minutes],
        );
    }

    /** Rounded to 5 minutes, like a norm someone would write down. */
    private static function scaled(int $minutes, float $factor): int
    {
        return max(5, (int) round($minutes * $factor / 5) * 5);
    }
}
