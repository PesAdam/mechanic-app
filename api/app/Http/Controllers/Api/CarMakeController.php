<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarEngine;
use App\Models\CarMake;
use App\Models\CarModel;
use App\Services\CarCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Značky a modely: the vehicle catalogue that cars, norms and samples hang off. */
class CarMakeController extends Controller
{
    public function index(): JsonResponse
    {
        $makes = CarMake::query()->withCount('cars')->with(['models' => fn ($q) => $q->withCount('cars')->with(['engines' => fn ($e) => $e->withCount('cars')])])->orderBy('name')->get();

        return response()->json(['data' => $makes->map(fn (CarMake $m) => self::payload($m))->values()]);
    }

    /** Loads the bundled makes, models and engines; idempotent. */
    public function importDefaults(): JsonResponse
    {
        $n = CarCatalog::importDefaults();

        return response()->json(['imported' => $n, 'data' => CarMake::query()->withCount('cars')->with(['models' => fn ($q) => $q->withCount('cars')->with(['engines' => fn ($e) => $e->withCount('cars')])])->orderBy('name')->get()->map(fn (CarMake $m) => self::payload($m))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:64', 'unique:car_makes,name'], 'logo_url' => ['nullable', 'url', 'max:255']]);

        $make = CarMake::query()->create($data);

        return response()->json(['data' => self::payload($make->load('models'))], 201);
    }

    public function update(Request $request, CarMake $make): JsonResponse
    {
        $data = $request->validate(['name' => ['sometimes', 'string', 'max:64', Rule::unique('car_makes', 'name')->ignore($make->id)], 'logo_url' => ['sometimes', 'nullable', 'url', 'max:255']]);

        $make->update($data);
        $make->models()->each(fn (CarModel $m) => $m->cars()->update(['make' => $make->name]));

        return response()->json(['data' => self::payload($make->fresh()->load(['models' => fn ($q) => $q->withCount('cars')->with('engines')]))]);
    }

    public function storeEngine(Request $request, CarModel $model): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:64', Rule::unique('car_engines', 'name')->where('car_model_id', $model->id)]]);

        $model->engines()->create($data);

        return response()->json(['data' => self::payload($model->make->fresh()->load(['models' => fn ($q) => $q->withCount('cars')->with('engines')]))], 201);
    }

    public function destroyEngine(CarEngine $engine): JsonResponse
    {
        abort_if($engine->cars()->exists(), 409, 'Motorizácia má autá na zákazkách, nedá sa zmazať.');
        $make = $engine->model->make;
        $engine->delete();

        return response()->json(['data' => self::payload($make->fresh()->load(['models' => fn ($q) => $q->withCount('cars')->with('engines')]))]);
    }

    public function destroy(CarMake $make): JsonResponse
    {
        abort_if(CarModel::query()->where('car_make_id', $make->id)->whereHas('cars')->exists(), 409, 'Značka má autá na zákazkách, nedá sa zmazať.');
        $make->delete();

        return response()->json(null, 204);
    }

    public function storeModel(Request $request, CarMake $make): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:128', Rule::unique('car_models', 'name')->where('car_make_id', $make->id)]]);

        $make->models()->create($data);

        return response()->json(['data' => self::payload($make->fresh()->load(['models' => fn ($q) => $q->withCount('cars')->with('engines')]))], 201);
    }

    public function updateModel(Request $request, CarModel $model): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:128', Rule::unique('car_models', 'name')->where('car_make_id', $model->car_make_id)->ignore($model->id)]]);

        $model->update($data);
        $model->cars()->update(['model' => $model->name]);

        return response()->json(['data' => self::payload($model->make->fresh()->load(['models' => fn ($q) => $q->withCount('cars')->with('engines')]))]);
    }

    public function destroyModel(CarModel $model): JsonResponse
    {
        abort_if($model->cars()->exists(), 409, 'Model má autá na zákazkách, nedá sa zmazať.');
        $make = $model->make;
        $model->delete();

        return response()->json(['data' => self::payload($make->fresh()->load(['models' => fn ($q) => $q->withCount('cars')->with('engines')]))]);
    }

    /** @return array<string, mixed> */
    public static function payload(CarMake $m): array
    {
        return [
            'id' => $m->id,
            'name' => $m->name,
            'logo_url' => $m->logo_url,
            'cars_count' => (int) ($m->cars_count ?? 0),
            'models' => $m->models->map(fn (CarModel $x) => [
                'id' => $x->id, 'car_make_id' => $x->car_make_id, 'name' => $x->name, 'years' => $x->years, 'cars_count' => (int) ($x->cars_count ?? 0),
                'engines' => $x->engines->map(fn (CarEngine $e) => ['id' => $e->id, 'car_model_id' => $e->car_model_id, 'name' => $e->name, 'cars_count' => (int) ($e->cars_count ?? 0)])->values(),
            ])->values(),
        ];
    }
}
