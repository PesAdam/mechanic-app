<?php

namespace App\Http\Controllers\Api;

use App\Enums\CodeStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\DiagCode;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DiagnosticController extends Controller
{
    /** Import of the diagnostic protocol (PDF or text export) as an attachment. */
    public function store(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,txt,csv,log', 'max:20480'],
            'pages' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);

        $file = $request->file('file');
        $path = $file->store("diagnostics/{$order->id}", 'public');

        $existing = $order->diagnostic;
        if ($existing?->file_path) {
            Storage::disk('public')->delete($existing->file_path);
        }

        $order->diagnostic()->updateOrCreate([], [
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'pages' => $data['pages'] ?? 0,
            'imported_at' => now(),
        ]);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($order->id));
    }

    /** Ručne vypísaný chybový kód. Creates the diagnostic record when none exists yet. */
    public function storeCode(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:16'],
            'description' => ['nullable', 'string', 'max:255'],
            'unit' => ['nullable', 'string', 'max:64'],
            'status' => ['nullable', Rule::enum(CodeStatus::class)],
        ]);

        $diagnostic = $order->diagnostic ?? $order->diagnostic()->create([
            'file_name' => 'Ručný zápis',
            'pages' => 0,
            'imported_at' => now(),
        ]);

        $diagnostic->codes()->create([
            'code' => mb_strtoupper($data['code']),
            'description' => $data['description'] ?? null,
            'unit' => $data['unit'] ?? null,
            'status' => $data['status'] ?? CodeStatus::Open->value,
        ]);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($order->id));
    }

    public function updateCode(Request $request, DiagCode $code): WorkOrderResource
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::enum(CodeStatus::class)],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $code->update($data);

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($code->diagnostic->work_order_id));
    }

    public function destroyCode(DiagCode $code): WorkOrderResource
    {
        $orderId = $code->diagnostic->work_order_id;
        $code->delete();

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($orderId));
    }
}
