<?php

namespace App\Http\Resources;

use App\Models\DiagCode;
use App\Models\OrderOperation;
use App\Models\Part;
use App\Models\Photo;
use App\Models\WorkEntry;
use App\Services\OrderTotals;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkOrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $now = now();

        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'parts_pricing' => $this->parts_pricing->value,
            'summary' => $this->summary,
            'lift' => $this->lift,
            'received_at' => $this->received_at?->toISOString(),
            'closed_at' => $this->closed_at?->toISOString(),
            'public_token' => $this->public_token,
            'customer' => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'phone' => $this->customer->phone,
                'email' => $this->customer->email,
            ],
            'car' => [
                'id' => $this->car->id,
                'make' => $this->car->make,
                'model' => $this->car->model,
                'engine' => $this->car->engine,
                'car_model_id' => $this->car->car_model_id,
                'car_engine_id' => $this->car->car_engine_id,
                'car_make_id' => $this->car->carModel?->car_make_id,
                'logo_url' => $this->car->carModel?->make?->logo_url,
                'plate' => $this->car->plate,
                'vin' => $this->car->vin,
                'km' => $this->car->km,
            ],
            'mechanic' => $this->mechanic ? ['id' => $this->mechanic->id, 'name' => $this->mechanic->name] : null,
            'parts' => $this->parts->map(fn (Part $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'meta' => $p->meta,
                'price' => (float) $p->price,
                'purchase_price' => $p->purchase_price !== null ? (float) $p->purchase_price : null,
                'used' => $p->used,
                'added_at' => $p->added_at->toISOString(),
            ])->values(),
            'photos' => $this->photos->map(fn (Photo $p) => [
                'id' => $p->id,
                'url' => $p->url(),
                'label' => $p->label,
                'stage' => $p->stage->value,
                'taken_at' => $p->taken_at->toISOString(),
            ])->values(),
            'diagnostic' => $this->diagnostic ? [
                'id' => $this->diagnostic->id,
                'file_name' => $this->diagnostic->file_name,
                'file_url' => $this->diagnostic->fileUrl(),
                'pages' => $this->diagnostic->pages,
                'imported_at' => $this->diagnostic->imported_at->toISOString(),
                'codes' => $this->diagnostic->codes->map(fn (DiagCode $c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'description' => $c->description,
                    'unit' => $c->unit,
                    'status' => $c->status->value,
                ])->values(),
            ] : null,
            'work_entries' => $this->workEntries->map(fn (WorkEntry $e) => [
                'id' => $e->id,
                'user' => ['id' => $e->user->id, 'name' => $e->user->name],
                'started_at' => $e->started_at->toISOString(),
                'ended_at' => $e->ended_at?->toISOString(),
                'seconds' => $e->seconds($now),
                'note' => $e->note,
                'manual' => $e->manual,
            ])->values(),
            'operations' => $this->operations->map(fn (OrderOperation $o) => [
                'id' => $o->id,
                'operation_id' => $o->operation_id,
                'name' => $o->name,
                'norm_minutes' => $o->norm_minutes,
                'done' => $o->done,
            ])->values(),
            'totals' => OrderTotals::compute($this->resource, Settings::rate(), $now),
        ];
    }
}
