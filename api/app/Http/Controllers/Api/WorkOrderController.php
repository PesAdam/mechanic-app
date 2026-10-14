<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Enums\PartsPricing;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\Car;
use App\Models\Customer;
use App\Models\WorkOrder;
use App\Services\CarCatalog;
use App\Services\OperationSamples;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WorkOrderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = WorkOrder::query()->withEverything()->orderByDesc('received_at')->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return WorkOrderResource::collection($query->limit(300)->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer.name' => ['required', 'string', 'max:120'],
            'customer.phone' => ['nullable', 'string', 'max:32'],
            'customer.email' => ['nullable', 'email', 'max:120'],
            'car.id' => ['nullable', 'integer', 'exists:cars,id'],
            'car.make' => ['required', 'string', 'max:64'],
            'car.model' => ['required', 'string', 'max:128'],
            'car.engine' => ['nullable', 'string', 'max:64'],
            'car.plate' => ['required', 'string', 'max:16'],
            'car.vin' => ['nullable', 'string', 'max:17'],
            'car.km' => ['nullable', 'integer', 'min:0'],
            'summary' => ['required', 'string', 'max:255'],
            'lift' => ['nullable', 'string', 'max:32'],
        ]);

        $order = DB::transaction(function () use ($data) {
            $vehicle = CarCatalog::resolve($data['car']['make'], $data['car']['model'], $data['car']['engine'] ?? null);
            $attributes = [
                'make' => $vehicle['make']->name,
                'model' => $vehicle['model']->name,
                'engine' => $vehicle['engine']?->name,
                'car_model_id' => $vehicle['model']->id,
                'car_engine_id' => $vehicle['engine']?->id,
                'plate' => mb_strtoupper($data['car']['plate']),
                'vin' => isset($data['car']['vin']) ? mb_strtoupper($data['car']['vin']) : null,
                'km' => $data['car']['km'] ?? 0,
            ];

            // A returning car keeps its history: same car row, same customer (details refreshed).
            $car = isset($data['car']['id']) ? Car::query()->with('customer')->find($data['car']['id']) : null;
            if ($car) {
                $car->update(['km' => max($car->km, $attributes['km'])] + $attributes);
                $customer = $car->customer;
                $customer->update(array_filter($data['customer'], fn ($v) => $v !== null && $v !== ''));
            } else {
                $customer = Customer::query()->create($data['customer']);
                $car = Car::query()->create($attributes + ['customer_id' => $customer->id]);
            }

            return WorkOrder::query()->create([
                'customer_id' => $customer->id,
                'car_id' => $car->id,
                'summary' => $data['summary'],
                'lift' => $data['lift'] ?? null,
                'status' => OrderStatus::New,
                'received_at' => now(),
            ]);
        });

        return (new WorkOrderResource($this->loaded($order)))->response()->setStatusCode(201);
    }

    public function show(WorkOrder $order): WorkOrderResource
    {
        return new WorkOrderResource($this->loaded($order));
    }

    public function update(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'summary' => ['sometimes', 'string', 'max:255'],
            'lift' => ['sometimes', 'nullable', 'string', 'max:32'],
            'status' => ['sometimes', Rule::enum(OrderStatus::class)],
            'parts_pricing' => ['sometimes', Rule::enum(PartsPricing::class)],
            'mechanic_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'km' => ['sometimes', 'integer', 'min:0', 'max:9999999'],
            'customer.name' => ['sometimes', 'string', 'max:120'],
            'customer.phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'customer.email' => ['sometimes', 'nullable', 'email', 'max:120'],
        ]);

        DB::transaction(function () use ($order, $data): void {
            if (array_key_exists('km', $data)) {
                $order->car->update(['km' => $data['km']]);
            }
            if (isset($data['customer'])) {
                $order->customer->update($data['customer']);
            }
            $order->update(Arr::except($data, ['km', 'customer']));
        });

        return new WorkOrderResource($this->loaded($order));
    }

    /** Uzavrieť: picks the part pricing for the report, stops every running stopwatch and moves the order to "čaká na platbu". */
    public function close(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate(['parts_pricing' => ['nullable', Rule::enum(PartsPricing::class)]]);

        DB::transaction(function () use ($order, $data): void {
            $order->workEntries()->whereNull('ended_at')->update(['ended_at' => now()]);

            $update = ['parts_pricing' => $data['parts_pricing'] ?? $order->parts_pricing->value];
            if ($order->status !== OrderStatus::Done) {
                $update += ['status' => OrderStatus::Unpaid, 'closed_at' => $order->closed_at ?? now()];
            }
            $order->update($update);

            OperationSamples::record($order->fresh());
        });

        return new WorkOrderResource($this->loaded($order));
    }

    private function loaded(WorkOrder $order): WorkOrder
    {
        return $order->fresh()->load(['customer', 'car.carModel.make', 'mechanic', 'parts', 'photos', 'diagnostic.codes', 'workEntries.user', 'operations']);
    }
}
