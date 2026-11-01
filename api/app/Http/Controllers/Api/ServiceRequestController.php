<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceRequestResource;
use App\Models\ServiceRequest;
use App\Services\ServiceRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Požiadavky: what invited clients sent, for the owner to turn into orders or turn down. */
class ServiceRequestController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        self::ownerOnly($request);

        return ServiceRequestResource::collection(ServiceRequest::query()->with(['client', 'workOrder'])->latest('id')->limit(200)->get());
    }

    public function accept(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        self::ownerOnly($request);
        $order = ServiceRequests::accept($serviceRequest);

        return response()->json(['order_id' => $order->id, 'data' => new ServiceRequestResource($serviceRequest->fresh(['client', 'workOrder']))]);
    }

    public function reject(Request $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        self::ownerOnly($request);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        ServiceRequests::reject($serviceRequest, $data['reason'] ?? null);

        return new ServiceRequestResource($serviceRequest->fresh(['client', 'workOrder']));
    }

    private static function ownerOnly(Request $request): void
    {
        abort_unless($request->user()->isOwner(), 403, 'Požiadavky vybavuje majiteľ.');
    }
}
