<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\WorkOrder;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;

/** The customer's "online verzia" of a report, reachable by its unguessable token. */
class PublicReportController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $order = WorkOrder::query()->withEverything()->where('public_token', $token)->firstOrFail();

        return response()->json([
            'order' => (new WorkOrderResource($order))->forPublic(),
            'settings' => Settings::publicPayload(),
        ]);
    }
}
