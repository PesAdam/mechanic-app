<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Operation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The catalogue of standard jobs and their norm times, with the shop's own measured average. */
class OperationController extends Controller
{
    public function index(): JsonResponse
    {
        $ops = Operation::query()
            ->withCount('samples')
            ->withAvg('samples', 'actual_seconds')
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $ops->map(fn (Operation $o) => self::payload($o))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160', 'unique:operations,name'],
            'category' => ['nullable', Rule::in(Operation::CATEGORIES)],
            'norm_minutes' => ['required', 'integer', 'min:1', 'max:6000'],
        ]);

        $op = Operation::query()->create([...$data, 'category' => $data['category'] ?? 'ine']);

        return response()->json(['data' => self::payload($op->loadCount('samples')->loadAvg('samples', 'actual_seconds'))], 201);
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

        return response()->json(['data' => self::payload($operation->fresh()->loadCount('samples')->loadAvg('samples', 'actual_seconds'))]);
    }

    /** A job with history is only deactivated so the averages survive. */
    public function destroy(Operation $operation): JsonResponse
    {
        if ($operation->samples()->exists()) {
            $operation->update(['is_active' => false]);

            return response()->json(['data' => self::payload($operation->fresh()->loadCount('samples')->loadAvg('samples', 'actual_seconds'))]);
        }

        $operation->delete();

        return response()->json(null, 204);
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
        ];
    }
}
