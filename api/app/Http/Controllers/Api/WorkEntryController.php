<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use App\Services\OperationSamples;
use App\Services\OrderTotals;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class WorkEntryController extends Controller
{
    /** Ručný zápis: a finished stint typed in after the fact, always with an author, optionally against a job. */
    public function store(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'note' => ['nullable', 'string', 'max:500'],
            'user_id' => ['nullable', 'exists:users,id'],
            'order_operation_id' => ['nullable', Rule::exists('order_operations', 'id')->where('work_order_id', $order->id)],
        ]);

        $userId = $data['user_id'] ?? $request->user()->id;
        $end = now();

        $order->workEntries()->create([
            'user_id' => $userId,
            'order_operation_id' => $data['order_operation_id'] ?? null,
            'started_at' => $end->copy()->subMinutes($data['minutes']),
            'ended_at' => $end,
            'note' => $data['note'] ?? null,
            'manual' => true,
        ]);

        $order->update([
            'status' => in_array($order->status, [OrderStatus::New, OrderStatus::Waiting], true) ? OrderStatus::Open : $order->status,
            'mechanic_id' => $order->mechanic_id ?? $userId,
        ]);
        OperationSamples::refresh($order);
        OrderTotals::rebase($order);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($order->id));
    }

    /** Priradenie k úkonu (or a note) after the fact, on a running or finished stint, also after the order was closed. */
    public function update(Request $request, WorkEntry $entry): WorkOrderResource
    {
        $order = $entry->workOrder;

        $data = $request->validate([
            'order_operation_id' => ['sometimes', 'nullable', Rule::exists('order_operations', 'id')->where('work_order_id', $order->id)],
            'note' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $entry->update($data);
        OperationSamples::refresh($order);
        OrderTotals::rebase($order);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($order->id));
    }

    public function destroy(WorkEntry $entry): Response
    {
        $order = $entry->workOrder;

        $entry->delete();
        OperationSamples::refresh($order);
        OrderTotals::rebase($order);

        return response()->noContent();
    }
}
