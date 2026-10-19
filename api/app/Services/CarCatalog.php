<?php

namespace App\Services;

use App\Models\CarEngine;
use App\Models\CarMake;
use App\Models\CarModel;
use App\Models\OperationNorm;
use App\Models\OperationSample;
use App\Support\VehicleCatalog;
use Illuminate\Database\Eloquent\Collection;

/**
 * Finds or creates the make / model / engine a typed-in car belongs to.
 * Names are matched case-insensitively in PHP (SQLite's LOWER() ignores diacritics).
 */
final class CarCatalog
{
    /** @return array{make: CarMake, model: CarModel, engine: CarEngine|null} */
    public static function resolve(string $make, string $model, ?string $engine = null): array
    {
        $carMake = self::findMake($make)
            ?? CarMake::query()->create(['name' => trim($make), 'slug' => VehicleCatalog::slugFor($make), 'logo_url' => VehicleCatalog::logoUrl(VehicleCatalog::slugFor($make))]);

        $carModel = self::pick($carMake->models()->get(), $model)
            ?? CarModel::query()->create(['car_make_id' => $carMake->id, 'name' => trim($model)]);

        $carEngine = null;
        if ($engine !== null && trim($engine) !== '') {
            $carEngine = self::pick($carModel->engines()->get(), $engine)
                ?? CarEngine::query()->create(['car_model_id' => $carModel->id, 'name' => trim($engine)]);
        }

        return ['make' => $carMake, 'model' => $carModel, 'engine' => $carEngine];
    }

    /** Loads the bundled catalogue; safe to run repeatedly. Returns how many makes were touched. */
    public static function importDefaults(): int
    {
        $n = 0;
        foreach (VehicleCatalog::makes() as $name => $def) {
            $make = self::findMake($name) ?? CarMake::query()->create(['name' => $name]);
            if (! $make->logo_url) {
                $make->update(['slug' => $def['slug'], 'logo_url' => VehicleCatalog::logoUrl($def['slug'])]);
            }
            $models = $make->models()->get();
            foreach ($def['models'] as $modelName => [$years, $engines]) {
                $model = self::pick($models, $modelName);
                if (! $model) {
                    $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => $modelName, 'years' => $years]);
                    $models->push($model);
                } elseif ($years && $model->years !== $years) {
                    // Production years are catalogue facts, not something the shop edits: keep them in step.
                    $model->update(['years' => $years]);
                }
                $existing = $model->engines()->get();
                foreach ($engines as $engineName) {
                    if (! self::pick($existing, $engineName)) {
                        $existing->push(CarEngine::query()->create(['car_model_id' => $model->id, 'name' => $engineName]));
                    }
                }
            }
            self::dropSupersededModels($make, array_keys($def['models']));
            $n++;
        }

        return $n;
    }

    /**
     * An earlier catalogue had generic names ("Clio"); once "Clio III" exists, an unused
     * generic model (no cars, norms or samples) is only noise and is removed.
     */
    /** @param  list<string>  $catalogue  names the bundled catalogue currently has for this make (never dropped) */
    private static function dropSupersededModels(CarMake $make, array $catalogue): void
    {
        $keep = array_map(mb_strtolower(...), $catalogue);
        $models = $make->models()->withCount(['cars'])->get();
        foreach ($models as $model) {
            if (in_array(mb_strtolower($model->name), $keep, true)) {
                continue;
            }
            if ($model->cars_count > 0 || OperationNorm::query()->where('car_model_id', $model->id)->exists() || OperationSample::query()->where('car_model_id', $model->id)->exists()) {
                continue;
            }
            $prefix = mb_strtolower($model->name).' ';
            $superseded = $models->contains(fn (CarModel $other) => $other->id !== $model->id && str_starts_with(mb_strtolower($other->name), $prefix));
            if ($superseded) {
                $model->delete();
            }
        }
    }

    public static function findMake(string $name): ?CarMake
    {
        return self::pick(CarMake::query()->get(), $name);
    }

    /**
     * @template T of CarMake|CarModel|CarEngine
     *
     * @param  Collection<int, T>  $rows
     * @return T|null
     */
    private static function pick(Collection $rows, string $name)
    {
        $needle = mb_strtolower(trim($name));

        return $rows->first(fn ($row) => mb_strtolower($row->name) === $needle);
    }
}
