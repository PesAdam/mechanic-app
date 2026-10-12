<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\Part;
use App\Models\WorkOrder;
use Illuminate\Http\Request;

class PartController extends Controller
{
    public function store(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'meta' => ['nullable', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0', 'max:999999'],
            'purchase_price' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'used' => ['nullable', 'boolean'],
        ]);

        $order->parts()->create([...$data, 'used' => $data['used'] ?? true, 'added_at' => now()]);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($order->id));
    }

    public function update(Request $request, Part $part): WorkOrderResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'meta' => ['sometimes', 'nullable', 'string', 'max:255'],
            'price' => ['sometimes', 'numeric', 'min:0', 'max:999999'],
            'purchase_price' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:999999'],
            'used' => ['sometimes', 'boolean'],
        ]);

        $part->update($data);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($part->work_order_id));
    }

    public function destroy(Part $part): WorkOrderResource
    {
        $orderId = $part->work_order_id;
        $part->delete();

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($orderId));
    }
}
