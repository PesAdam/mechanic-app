<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A client's request as the shop sees it: who sent it, the car, what to do, and the order it became. */
class ServiceRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client' => ['id' => $this->client->id, 'name' => $this->client->name, 'phone' => $this->client->phone, 'email' => $this->client->email],
            'plate' => $this->plate,
            'make' => $this->make,
            'model' => $this->model,
            'engine' => $this->engine,
            'vin' => $this->vin,
            'km' => $this->km,
            'description' => $this->description,
            'preferred_date' => $this->preferred_date?->toDateString(),
            'photos' => $this->photoUrls(),
            'status' => $this->status->value,
            'reject_reason' => $this->reject_reason,
            'created_at' => $this->created_at->toISOString(),
            'handled_at' => $this->handled_at?->toISOString(),
            'order' => $this->workOrder ? ['id' => $this->workOrder->id, 'number' => $this->workOrder->number, 'status' => $this->workOrder->status->value] : null,
        ];
    }
}
