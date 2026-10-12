<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Car;
use App\Models\CarModel;
use App\Services\CarCatalog;
use App\Support\VinDecoder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Vyhľadanie vozidla podľa ŠPZ alebo VIN. The public Slovak register (RPZV) has no
 * API, so this searches the shop's own history; a VIN additionally yields make, model
 * year and (for covered makers) the generation, matched to the catalogue when possible.
 * An external source (RPZV contributor access, a paid decoder) would plug in here.
 */
class VehicleLookupController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $compact = strtoupper(preg_replace('/[\s-]+/', '', $q) ?? '');

        if (strlen($compact) < 3) {
            return response()->json(['matches' => [], 'vin' => null]);
        }

        $cars = Car::query()
            ->with(['customer', 'carModel.make'])
            ->where(function ($query) use ($compact) {
                $query->whereRaw("REPLACE(REPLACE(UPPER(plate), ' ', ''), '-', '') LIKE ?", ["%{$compact}%"])
                    ->orWhereRaw('UPPER(vin) LIKE ?', ["%{$compact}%"]);
            })
            ->latest('updated_at')
            ->limit(5)
            ->get();

        $matches = $cars->map(function (Car $car) {
            $orders = $car->workOrders()->orderByDesc('received_at')->get(['id', 'number', 'received_at', 'summary']);
            $last = $orders->first();

            return [
                'car' => [
                    'id' => $car->id, 'make' => $car->make, 'model' => $car->model, 'engine' => $car->engine,
                    'car_make_id' => $car->carModel?->car_make_id, 'car_model_id' => $car->car_model_id, 'car_engine_id' => $car->car_engine_id,
                    'logo_url' => $car->carModel?->make?->logo_url, 'plate' => $car->plate, 'vin' => $car->vin, 'km' => $car->km,
                ],
                'customer' => ['id' => $car->customer->id, 'name' => $car->customer->name, 'phone' => $car->customer->phone, 'email' => $car->customer->email],
                'orders_count' => $orders->count(),
                'last_order' => $last ? ['id' => $last->id, 'number' => $last->number, 'received_at' => $last->received_at?->toISOString(), 'summary' => $last->summary] : null,
            ];
        })->values();

        return response()->json(['matches' => $matches, 'vin' => strlen($compact) === 17 ? $this->vin($compact) : null]);
    }

    /** @return array<string, mixed> */
    private function vin(string $vin): array
    {
        $decoded = VinDecoder::decode($vin);
        $make = $decoded['make'] ? CarCatalog::findMake($decoded['make']) : null;
        $catalogue = $make ? $make->models()->get() : collect();

        $models = array_map(function (string $name) use ($catalogue) {
            $model = $catalogue->first(fn (CarModel $m) => mb_strtolower($m->name) === mb_strtolower($name));

            return ['name' => $name, 'car_model_id' => $model?->id, 'years' => $model?->years];
        }, $decoded['models']);

        return [
            'valid' => $decoded['valid'],
            'make' => $decoded['make'],
            'car_make_id' => $make?->id,
            'logo_url' => $make?->logo_url,
            'year' => $decoded['year'],
            'models' => $models,
        ];
    }
}
