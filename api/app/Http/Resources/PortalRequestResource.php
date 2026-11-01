<?php

namespace App\Http\Resources;

use App\Enums\OrderStatus;
use App\Enums\RequestStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A request as its sender sees it: what they sent and how far it got. Of the shop's order only the number,
 * the planned day and, once it is finished, the link to the same report a customer gets.
 */
class PortalRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $order = $this->status === RequestStatus::Accepted ? $this->workOrder : null;

        return [
            'id' => $this->id,
            'plate' => $this->plate,
            'make' => $this->make,
            'model' => $this->model,
            'engine' => $this->engine,
            'vin' => $this->vin,
            'km' => $this->km,
            'description' => $this->description,
            'preferred_date' => $this->preferred_date?->toDateString(),
            'photos' => $this->photoUrls(),
            'created_at' => $this->created_at->toISOString(),
            'phase' => $this->phase(),
            'reject_reason' => $this->status === RequestStatus::Rejected ? $this->reject_reason : null,
            'order' => $order ? [
                'number' => $order->number,
                'planned_at' => $order->planned_at?->toISOString(),
                'report_token' => $order->status->isClosed() ? $order->public_token : null,
            ] : null,
        ];
    }

    /** sent → accepted → in_progress → done, or rejected. */
    private function phase(): string
    {
        if ($this->status === RequestStatus::New) {
            return 'sent';
        }
        if ($this->status === RequestStatus::Rejected) {
            return 'rejected';
        }

        return match ($this->workOrder?->status) {
            OrderStatus::Open => 'in_progress',
            OrderStatus::Unpaid, OrderStatus::Done => 'done',
            default => 'accepted',
        };
    }
}
