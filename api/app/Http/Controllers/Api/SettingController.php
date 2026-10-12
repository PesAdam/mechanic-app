<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(Settings::payload());
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403, 'Nastavenia môže meniť len majiteľ.');

        $data = $request->validate([
            'hourly_rate' => ['sometimes', 'numeric', 'min:1', 'max:500'],
            'labor_billing' => ['sometimes', Rule::in(Settings::BILLING_MODES)],
            'business' => ['sometimes', 'array'],
            'business.name' => ['sometimes', 'string', 'max:120'],
            'business.owner' => ['sometimes', 'nullable', 'string', 'max:120'],
            'business.street' => ['sometimes', 'nullable', 'string', 'max:120'],
            'business.city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'business.phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'business.email' => ['sometimes', 'nullable', 'email', 'max:120'],
            'business.iban' => ['sometimes', 'nullable', 'string', 'max:40'],
            'business.ico' => ['sometimes', 'nullable', 'string', 'max:20'],
            'business.vat_payer' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('hourly_rate', $data)) {
            Setting::set('hourly_rate', $data['hourly_rate']);
        }
        if (array_key_exists('labor_billing', $data)) {
            Setting::set('labor_billing', $data['labor_billing']);
        }
        Settings::forget();

        foreach ($data['business'] ?? [] as $key => $value) {
            Setting::set("business.$key", is_bool($value) ? (int) $value : $value);
        }

        return response()->json(Settings::payload());
    }
}
