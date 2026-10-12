<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TimerController extends Controller
{
    /** Štart: opens a stint for the signed-in mechanic. One mechanic is at one car at a time. */
    public function start(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        abort_if($order->isClosed(), 409, 'Zákazka je uzavretá.');

        $user = $request->user();
        $now = now();

        DB::transaction(function () use ($order, $user, $now, $data): void {
            WorkEntry::query()
                ->where('user_id', $user->id)
                ->whereNull('ended_at')
                ->where('work_order_id', '!=', $order->id)
                ->update(['ended_at' => $now]);

            $running = $order->workEntries()->where('user_id', $user->id)->whereNull('ended_at')->exists();

            if (! $running) {
                $order->workEntries()->create([
                    'user_id' => $user->id,
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

    /** Pauza: closes the signed-in mechanic's running stint on this order. */
    public function stop(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        $update = ['ended_at' => now()];
        if (array_key_exists('note', $data) && $data['note'] !== null) {
            $update['note'] = $data['note'];
        }

        $order->workEntries()->where('user_id', $request->user()->id)->whereNull('ended_at')->update($update);

        return new WorkOrderResource($order->fresh()->withEverything()->find($order->id));
    }
}
