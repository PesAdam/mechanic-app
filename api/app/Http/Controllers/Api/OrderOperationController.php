<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\Operation;
use App\Models\OrderOperation;
use App\Models\WorkOrder;
use App\Services\Norms;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $order = $orderOperation->workOrder;
        abort_if($order->isClosed(), 409, 'Zákazka je uzavretá.');

        DB::transaction(function () use ($request, $order, $orderOperation, $data): void {
            $orderOperation->update($data);

            // Ticking a job off moves the caller's stopwatch on to the next open job (or to plain order time)
            // instead of stopping it: the car is still on the lift. Colleagues clocked against the job keep running.
            if ($data['done'] ?? false) {
                $running = $orderOperation->workEntries()->whereNull('ended_at')->where('user_id', $request->user()->id)->first();
                if ($running) {
                    $next = $order->operations()->where('done', false)->where('id', '!=', $orderOperation->id)->orderBy('sort')->orderBy('id')->first();
                    $now = now();
                    $running->update(['ended_at' => $now]);
                    $order->workEntries()->create(['user_id' => $running->user_id, 'order_operation_id' => $next?->id, 'started_at' => $now]);
                }
            }
        });

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($orderOperation->work_order_id));
    }

    /** A job with clocked time is not deleted: that time would silently become "bez úkonu". Reassign it first. */
    public function destroy(OrderOperation $orderOperation): WorkOrderResource
    {
        abort_if($orderOperation->workOrder->isClosed(), 409, 'Zákazka je uzavretá.');
        abort_if($orderOperation->workEntries()->exists(), 409, 'Úkon má zapísaný čas – najprv ho preraďte na iný úkon alebo úkon označte ako hotový.');

        $orderId = $orderOperation->work_order_id;
        $orderOperation->delete();

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($orderId));
    }
}
