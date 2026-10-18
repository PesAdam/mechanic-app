<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\Operation;
use App\Models\OrderOperation;
use App\Models\WorkOrder;
use App\Services\Norms;
use Illuminate\Http\Request;

/** Jobs picked on an order; their norms add up to the time the stopwatch is measured against. */
class OrderOperationController extends Controller
{
    public function store(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'operation_id' => ['nullable', 'exists:operations,id'],
            'name' => ['required_without:operation_id', 'nullable', 'string', 'max:160'],
            'norm_minutes' => ['required_without:operation_id', 'nullable', 'integer', 'min:1', 'max:6000'],
        ]);

        abort_if($order->isClosed(), 409, 'Zákazka je uzavretá.');

        $catalog = isset($data['operation_id']) ? Operation::query()->find($data['operation_id']) : null;
        $resolved = $catalog ? Norms::resolve($catalog, $order->car) : null;

        $order->operations()->create([
            'operation_id' => $catalog?->id,
            'name' => $data['name'] ?? $catalog->name,
            'norm_minutes' => $data['norm_minutes'] ?? $resolved['minutes'],
            'sort' => $order->operations()->count(),
        ]);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($order->id));
    }

    public function update(Request $request, OrderOperation $orderOperation): WorkOrderResource
    {
        $data = $request->validate([
            'done' => ['sometimes', 'boolean'],
            'name' => ['sometimes', 'string', 'max:160'],
            'norm_minutes' => ['sometimes', 'integer', 'min:1', 'max:6000'],
        ]);

        $orderOperation->update($data);

        // Ticking a job off also stops whoever is still clocked against it.
        if ($data['done'] ?? false) {
            $orderOperation->workEntries()->whereNull('ended_at')->update(['ended_at' => now()]);
        }

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($orderOperation->work_order_id));
    }

    public function destroy(OrderOperation $orderOperation): WorkOrderResource
    {
        $orderId = $orderOperation->work_order_id;
        $orderOperation->delete();

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($orderId));
    }
}
