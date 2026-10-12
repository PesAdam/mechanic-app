<?php

namespace App\Http\Controllers\Api;

use App\Enums\PhotoStage;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkOrderResource;
use App\Models\Photo;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PhotoController extends Controller
{
    public function store(Request $request, WorkOrder $order): WorkOrderResource
    {
        $data = $request->validate([
            'image' => ['required', 'file', 'image', 'max:10240'],
            'label' => ['required', 'string', 'max:64'],
            'stage' => ['required', Rule::enum(PhotoStage::class)],
            'photo_id' => ['nullable', 'integer', Rule::exists('photos', 'id')->where('work_order_id', $order->id)],
        ]);

        $path = $request->file('image')->store("photos/{$order->id}", 'public');

        if (! empty($data['photo_id'])) {
            // Filling an existing empty slot (e.g. "Kotúč pred" seeded without a file).
            $photo = Photo::query()->findOrFail($data['photo_id']);
            if ($photo->path) {
                Storage::disk('public')->delete($photo->path);
            }
            $photo->update(['path' => $path, 'label' => $data['label'], 'stage' => $data['stage']]);
        } else {
            $order->photos()->create(['path' => $path, 'label' => $data['label'], 'stage' => $data['stage'], 'taken_at' => now()]);
        }

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($order->id));
    }

    public function destroy(Photo $photo): WorkOrderResource
    {
        $orderId = $photo->work_order_id;
        if ($photo->path) {
            Storage::disk('public')->delete($photo->path);
        }
        $photo->delete();

        return new WorkOrderResource(WorkOrder::query()->withEverything()->find($orderId));
    }
}
