<?php

namespace App\Http\Resources;

use App\Models\DiagCode;
use App\Models\OrderOperation;
use App\Models\Part;
use App\Models\Photo;
use App\Models\WorkEntry;
use App\Services\CustomerReport;
use App\Services\LaborSplit;
use App\Services\OrderTotals;
use App\Services\Settings;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkOrderResource extends JsonResource
{
    /** The unauthenticated customer view: only what the report prints, nothing that reveals the rate, purchase prices or the team. */
    private bool $public = false;

    public function forPublic(): static
    {
        $this->public = true;

        return $this;
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $now = now();
        $rate = Settings::rate();
        $mode = Settings::reportLabor();
        $totals = OrderTotals::compute($this->resource, $rate, $now);
        $split = LaborSplit::seconds($this->resource, $now)['by_op'];
        $amounts = LaborSplit::amounts($this->resource, $totals, $split);

        $data = [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'parts_pricing' => $this->parts_pricing->value,
            'total_original' => $this->total_original !== null ? (float) $this->total_original : null,
            'total_override' => $this->total_override !== null ? (float) $this->total_override : null,
            'summary' => $this->summary,
            'lift' => $this->lift,
            'received_at' => $this->received_at?->toISOString(),
            'planned_at' => $this->planned_at?->toISOString(),
            'planned_minutes' => $this->planned_minutes,
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
                'order_operation_id' => $e->order_operation_id,
                'auto_closed' => (bool) $e->auto_closed,
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
                // Time clocked against this job so far (running stints included, as of this response).
                'seconds' => (int) $this->workEntries->where('order_operation_id', $o->id)->sum(fn (WorkEntry $e) => $e->seconds($now)),
                // What the customer is billed for this job: its share of the measured time and its share of the labour total.
                'billed_seconds' => $split[$o->id] ?? 0,
                'amount' => $amounts[$o->id] ?? 0.0,
            ])->values(),
            'totals' => $totals,
            'report' => CustomerReport::build($this->resource, $totals, $split, $amounts, $mode, $now),
        ];

        return $this->public ? self::publicView($data, $mode) : $data;
    }

    /**
     * Strips the staff payload down to the customer's report. In the "price" and "total" modes no labour
     * time leaves the server (time and amount together give the rate away); purchase prices, the margin,
     * the mechanics and internal notes never do.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private static function publicView(array $data, string $mode): array
    {
        $times = $mode === 'time';
        $nc = $data['parts_pricing'] === 'nc';

        $data['summary'] = '';
        $data['lift'] = null;
        $data['mechanic'] = null;
        $data['planned_at'] = null;
        $data['planned_minutes'] = null;
        $data['total_original'] = null;
        $data['total_override'] = null;
        $data['work_entries'] = [];
        // The customer sees the price he pays per part, whichever price list the order bills.
        $data['parts'] = collect($data['parts'])->map(fn (array $p) => [...$p, 'price' => $nc ? ($p['purchase_price'] ?? $p['price']) : $p['price'], 'purchase_price' => null])->values();
        $data['operations'] = collect($data['operations'])->map(fn (array $o) => [
            'id' => $o['id'], 'operation_id' => null, 'name' => $o['name'], 'done' => $o['done'],
            'norm_minutes' => $times ? $o['norm_minutes'] : 0, 'seconds' => 0,
            'billed_seconds' => $times ? $o['billed_seconds'] : 0, 'amount' => $mode === 'price' ? $o['amount'] : 0.0,
        ])->values();
        $keep = ['labor', 'parts', 'grand', 'grand_computed', 'labor_billing', 'parts_pricing', ...($times ? ['seconds', 'norm_seconds'] : [])];
        $data['totals'] = array_intersect_key($data['totals'], array_flip($keep));

        return $data;
    }
}
