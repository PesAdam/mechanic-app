<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PhotoStage;
use App\Enums\RequestStatus;
use App\Models\Car;
use App\Models\Customer;
use App\Models\ServiceRequest;
use App\Models\WorkOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Turning a client's request into the shop's work order: the only way anything from the portal reaches the orders. */
final class ServiceRequests
{
    /**
     * The client's own customer record (made on the first acceptance), the car (a known plate keeps its history)
     * and copies of the photos, so the order and the request never share a file.
     */
    public static function accept(ServiceRequest $request): WorkOrder
    {
        return DB::transaction(function () use ($request): WorkOrder {
            $request = ServiceRequest::query()->with('client.customer')->lockForUpdate()->findOrFail($request->id);
            self::ensureNew($request);

            $client = $request->client;
            $customer = $client->customer;
            if (! $customer) {
                $customer = Customer::query()->create(['name' => $client->name, 'phone' => $client->phone, 'email' => $client->email]);
                $client->update(['customer_id' => $customer->id]);
            }

            $vin = $request->vin ? mb_strtoupper($request->vin) : null;
            $compact = str_replace([' ', '-'], '', mb_strtoupper($request->plate));
            $car = Car::query()->whereRaw("REPLACE(REPLACE(UPPER(plate), ' ', ''), '-', '') = ?", [$compact])->latest('id')->first();
            if ($car) {
                $car->update(['km' => max($car->km, $request->km ?? 0), 'vin' => $car->vin ?? $vin]);
            } else {
                $vehicle = CarCatalog::resolve($request->make, $request->model, $request->engine);
                $car = Car::query()->create([
                    'customer_id' => $customer->id,
                    'make' => $vehicle['make']->name,
                    'model' => $vehicle['model']->name,
                    'engine' => $vehicle['engine']?->name,
                    'car_model_id' => $vehicle['model']->id,
                    'car_engine_id' => $vehicle['engine']?->id,
                    'plate' => mb_strtoupper($request->plate),
                    'vin' => $vin,
                    'km' => $request->km ?? 0,
                ]);
            }

            $order = WorkOrder::query()->create([
                'customer_id' => $customer->id,
                'car_id' => $car->id,
                'summary' => Str::limit((string) preg_replace('/\s+/u', ' ', trim($request->description)), 250),
                'status' => OrderStatus::New,
                'received_at' => now(),
            ]);

            $disk = Storage::disk('public');
            foreach (array_values($request->photos ?? []) as $i => $path) {
                $copy = "photos/{$order->id}/".basename($path);
                $disk->copy($path, $copy);
                $order->photos()->create(['path' => $copy, 'label' => 'Od zákazníka '.($i + 1), 'stage' => PhotoStage::Before, 'taken_at' => $request->created_at]);
            }

            $request->update(['status' => RequestStatus::Accepted, 'work_order_id' => $order->id, 'handled_at' => now()]);

            return $order;
        });
    }

    public static function reject(ServiceRequest $request, ?string $reason): void
    {
        DB::transaction(function () use ($request, $reason): void {
            $request = ServiceRequest::query()->lockForUpdate()->findOrFail($request->id);
            self::ensureNew($request);
            $request->update(['status' => RequestStatus::Rejected, 'reject_reason' => $reason, 'handled_at' => now()]);
        });
    }

    private static function ensureNew(ServiceRequest $request): void
    {
        if ($request->status !== RequestStatus::New) {
            throw ValidationException::withMessages(['request' => 'Požiadavka už bola vybavená.']);
        }
    }
}
