<?php

namespace App\Http\Controllers\Api\Portal;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PortalRequestResource;
use App\Models\ServiceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/** A client's own requests: send one, follow it, take it back while the shop has not looked at it. */
class PortalRequestController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return PortalRequestResource::collection($request->user()->requests()->with('workOrder')->latest('id')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plate' => ['required', 'string', 'max:16'],
            'make' => ['required', 'string', 'max:64'],
            'model' => ['required', 'string', 'max:128'],
            'engine' => ['nullable', 'string', 'max:64'],
            'vin' => ['nullable', 'string', 'max:17'],
            'km' => ['nullable', 'integer', 'min:0', 'max:9999999'],
            'description' => ['required', 'string', 'max:2000'],
            'preferred_date' => ['nullable', 'date', 'after_or_equal:today'],
            'photos' => ['nullable', 'array', 'max:6'],
            'photos.*' => ['file', 'image', 'max:10240'],
        ]);

        $serviceRequest = $request->user()->requests()->create([
            ...Arr::except($data, ['photos']),
            'plate' => mb_strtoupper(trim($data['plate'])),
            'vin' => isset($data['vin']) ? mb_strtoupper(trim($data['vin'])) : null,
            'status' => RequestStatus::New,
        ]);

        $paths = array_map(fn ($file) => $file->store("requests/{$serviceRequest->id}", 'public'), $request->file('photos', []));
        if ($paths) {
            $serviceRequest->update(['photos' => $paths]);
        }

        return (new PortalRequestResource($serviceRequest->load('workOrder')))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, ServiceRequest $serviceRequest): Response
    {
        abort_unless($serviceRequest->client_id === $request->user()->id, 404);
        if ($serviceRequest->status !== RequestStatus::New) {
            throw ValidationException::withMessages(['request' => 'Dielňa už požiadavku vybavila, zrušiť ju už nejde.']);
        }

        Storage::disk('public')->deleteDirectory("requests/{$serviceRequest->id}");
        $serviceRequest->delete();

        return response()->noContent();
    }
}
