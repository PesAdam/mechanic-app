<?php

namespace App\Models;

use App\Enums\RequestStatus;
use Database\Factories\ServiceRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/** A car and what to do with it, sent by a client. It touches the shop's orders only once the shop accepts it. */
#[Fillable(['client_id', 'plate', 'make', 'model', 'engine', 'vin', 'km', 'description', 'preferred_date', 'photos', 'status', 'work_order_id', 'reject_reason', 'handled_at'])]
class ServiceRequest extends Model
{
    /** @use HasFactory<ServiceRequestFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'km' => 'integer',
            'preferred_date' => 'date',
            'photos' => 'array',
            'status' => RequestStatus::class,
            'handled_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    /** @return list<string> */
    public function photoUrls(): array
    {
        return array_map(fn (string $path) => Storage::disk('public')->url($path), array_values($this->photos ?? []));
    }
}
