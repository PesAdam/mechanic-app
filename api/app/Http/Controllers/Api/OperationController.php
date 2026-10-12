<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Car;
use App\Models\Operation;
use App\Models\OperationNorm;
use App\Models\OperationSample;
use App\Services\Norms;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The catalogue of standard jobs: default norm, vehicle-specific norms and the shop's measured averages. */
class OperationController extends Controller
{
    /** With `car_model_id` every job also carries the norm and average that apply to that vehicle. */
    public function index(Request $request): JsonResponse
    {
        $makeId = $request->integer('car_make_id') ?: null;
        $modelId = $request->integer('car_model_id') ?: null;
        $engineId = $request->integer('car_engine_id') ?: null;
        $car = ($modelId || $engineId) ? new Car(['car_model_id' => $modelId, 'car_engine_id' => $engineId]) : null;
        $vehicle = $car || $makeId;

        $ops = Operation::query()
            ->with(['norms.make', 'norms.model', 'norms.engine'])
            ->withCount('samples')
            ->withAvg('samples', 'actual_seconds')
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        // Measured averages at the chosen level: engine → model → every model of the make.
        $carStats = $vehicle
            ? OperationSample::query()
                ->when($engineId, fn ($q) => $q->where('car_engine_id', $engineId))
                ->when(! $engineId && $modelId, fn ($q) => $q->where('car_model_id', $modelId))
                ->when(! $engineId && ! $modelId && $makeId, fn ($q) => $q->whereIn('car_model_id', fn ($sub) => $sub->select('id')->from('car_models')->where('car_make_id', $makeId)))
                ->selectRaw('operation_id, COUNT(*) as n, AVG(actual_seconds) as avg')
                ->groupBy('operation_id')->get()->keyBy('operation_id')
            : collect();

        return response()->json(['data' => $ops->map(function (Operation $o) use ($car, $makeId, $vehicle, $carStats) {
            $row = self::payload($o);
            if ($vehicle) {
                $resolved = Norms::resolve($o, $car, $makeId);
                $stat = $carStats->get($o->id);
                $row += [
                    'car_norm_minutes' => $resolved['minutes'],
                    'car_norm_source' => $resolved['source'],
                    'car_norm_id' => $resolved['norm_id'],
                    'car_avg_seconds' => $stat ? (int) round((float) $stat->avg) : null,
                    'car_samples_count' => $stat ? (int) $stat->n : 0,
                ];
            }

            return $row;
        })->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', 'unique:operations,name'],
            'category' => ['nullable', Rule::in(Operation::CATEGORIES)],
            'norm_minutes' => ['required', 'integer', 'min:1', 'max:6000'],
        ]);

        $op = Operation::query()->create([...$data, 'category' => $data['category'] ?? 'ine']);

        return response()->json(['data' => self::payload(self::reload($op))], 201);
    }

    public function update(Request $request, Operation $operation): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160', Rule::unique('operations', 'name')->ignore($operation->id)],
            'category' => ['sometimes', Rule::in(Operation::CATEGORIES)],
            'norm_minutes' => ['sometimes', 'integer', 'min:1', 'max:6000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $operation->update($data);

        return response()->json(['data' => self::payload(self::reload($operation))]);
    }

    /** A job with history is only deactivated so the averages survive. */
    public function destroy(Operation $operation): JsonResponse
    {
        if ($operation->samples()->exists()) {
            $operation->update(['is_active' => false]);

            return response()->json(['data' => self::payload(self::reload($operation))]);
        }

        $operation->delete();

        return response()->json(null, 204);
    }

    /** Vehicle-specific norm: for a make, or for one model of it. Replaces an existing one for the same vehicle. */
    public function storeNorm(Request $request, Operation $operation): JsonResponse
    {
        $data = $request->validate([
            'car_make_id' => ['required', 'exists:car_makes,id'],
            'car_model_id' => ['nullable', Rule::exists('car_models', 'id')->where('car_make_id', $request->integer('car_make_id'))],
            'car_engine_id' => ['nullable', Rule::exists('car_engines', 'id')->where('car_model_id', $request->integer('car_model_id'))],
            'norm_minutes' => ['required', 'integer', 'min:1', 'max:6000'],
        ]);

        OperationNorm::query()->updateOrCreate(
            ['operation_id' => $operation->id, 'car_make_id' => $data['car_make_id'], 'car_model_id' => $data['car_model_id'] ?? null, 'car_engine_id' => $data['car_engine_id'] ?? null],
            ['norm_minutes' => $data['norm_minutes']],
        );

        return response()->json(['data' => self::payload(self::reload($operation))]);
    }

    public function destroyNorm(OperationNorm $norm): JsonResponse
    {
        $operation = $norm->operation;
        $norm->delete();

        return response()->json(['data' => self::payload(self::reload($operation))]);
    }

    private static function reload(Operation $op): Operation
    {
        return Operation::query()->with(['norms.make', 'norms.model', 'norms.engine'])->withCount('samples')->withAvg('samples', 'actual_seconds')->findOrFail($op->id);
    }

    /** @return array<string, mixed> */
    public static function payload(Operation $o): array
    {
        return [
            'id' => $o->id,
            'name' => $o->name,
            'category' => $o->category,
            'norm_minutes' => $o->norm_minutes,
            'is_active' => $o->is_active,
            'samples_count' => (int) ($o->samples_count ?? 0),
            'avg_seconds' => $o->samples_avg_actual_seconds !== null ? (int) round((float) $o->samples_avg_actual_seconds) : null,
            'norms' => $o->norms->map(fn (OperationNorm $n) => [
                'id' => $n->id,
                'car_make_id' => $n->car_make_id,
                'car_make' => $n->make?->name,
                'car_model_id' => $n->car_model_id,
                'car_model' => $n->model?->name,
                'car_engine_id' => $n->car_engine_id,
                'car_engine' => $n->engine?->name,
                'norm_minutes' => $n->norm_minutes,
            ])->values(),
        ];
    }
}
