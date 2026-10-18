<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TimerController extends Controller
{
    /**
     * Štart: opens a stint for the signed-in mechanic, optionally against one job of the order.
     * One mechanic is at one car at a time; asking for a different job than the running stint's switches to it.
     */
    public function start(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
            'order_operation_id' => ['nullable', Rule::exists('order_operations', 'id')->where('work_order_id', $order->id)],
        ]);

        abort_if($order->isClosed(), 409, 'Zákazka je uzavretá.');

        $user = $request->user();
        $now = now();
        $operationId = isset($data['order_operation_id']) ? (int) $data['order_operation_id'] : null;

        DB::transaction(function () use ($order, $user, $now, $data, $operationId): void {
            WorkEntry::query()
                ->where('user_id', $user->id)
                ->whereNull('ended_at')
                ->where('work_order_id', '!=', $order->id)
                ->update(['ended_at' => $now]);

            $running = $order->workEntries()->where('user_id', $user->id)->whereNull('ended_at')->first();

            // Switching jobs closes the current stint; the same job (or none again) just keeps running.
            if ($running && $running->order_operation_id !== $operationId) {
                $running->update(['ended_at' => $now]);
                $running = null;
            }

            if (! $running) {
                $order->workEntries()->create([
                    'user_id' => $user->id,
                    'order_operation_id' => $operationId,
                    'started_at' => $now,
                    'note' => $data['note'] ?? null,
                ]);
            }

            $order->update([
                'status' => in_array($order->status, [OrderStatus::New, OrderStatus::Waiting], true) ? OrderStatus::Open : $order->status,
                'mechanic_id' => $order->mechanic_id ?? $user->id,
            ]);
        });

        return new WorkOrderResource($order->fresh()->withEverything()->find($order->id));
    }

    /**
     * Pauza: closes the signed-in mechanic's running stint on this order.
     * A job passed here lands on a stint that was started without one ("forgot at start, remembered at stop").
     */
    public function stop(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
            'order_operation_id' => ['nullable', Rule::exists('order_operations', 'id')->where('work_order_id', $order->id)],
        ]);

        $update = ['ended_at' => now()];
        if (array_key_exists('note', $data) && $data['note'] !== null) {
            $update['note'] = $data['note'];
        }

        $running = $order->workEntries()->where('user_id', $request->user()->id)->whereNull('ended_at')->get();
        foreach ($running as $entry) {
            $entry->update($update + ($entry->order_operation_id === null && isset($data['order_operation_id']) ? ['order_operation_id' => (int) $data['order_operation_id']] : []));
        }

        return new WorkOrderResource($order->fresh()->withEverything()->find($order->id));
    }
}
