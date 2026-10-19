<?php

namespace App\Services;

use App\Models\Setting;

final class Settings
{
    public const DEFAULT_RATE = 28.0;

    private const RATE_BINDING = 'mechanic.settings.rate';

    private const BILLING_BINDING = 'mechanic.settings.labor_billing';

    public const BILLING_MODES = ['actual', 'norm'];

    /** @var array<string, string> */
    public const BUSINESS_DEFAULTS = [
        'name' => 'NÁZOV',
        'owner' => '',
        'street' => '',
        'city' => '',
        'phone' => '',
        'email' => '',
        'iban' => '',
        'ico' => '',
        'vat_payer' => '0',
    ];

    /**
     * Hourly rate, memoized on the container so a resource collection does not
     * re-query it per order. The container lives one request (or one test).
     */
    public static function rate(): float
    {
        $app = app();
        if (! $app->bound(self::RATE_BINDING)) {
            $app->instance(self::RATE_BINDING, (float) Setting::get('hourly_rate', self::DEFAULT_RATE));
        }

        return (float) $app->make(self::RATE_BINDING);
    }

    /** 'actual' bills measured time, 'norm' bills the norm hours of the order's jobs. */
    public static function laborBilling(): string
    {
        $app = app();
        if (! $app->bound(self::BILLING_BINDING)) {
            $app->instance(self::BILLING_BINDING, (string) Setting::get('labor_billing', 'actual'));
        }

        return (string) $app->make(self::BILLING_BINDING);
    }

    public static function forget(): void
    {
        app()->forgetInstance(self::RATE_BINDING);
        app()->forgetInstance(self::BILLING_BINDING);
    }

    /** How the customer report prints labour: a price per job (default), time with the hourly rate, or just the total. */
    public const REPORT_LABOR_MODES = ['price', 'time', 'total'];

    public static function reportLabor(): string
    {
        $mode = (string) Setting::get('report_labor', 'price');

        return in_array($mode, self::REPORT_LABOR_MODES, true) ? $mode : 'price';
    }

    /**
     * What the unauthenticated report page gets: the business block and the report flags; the hourly rate only
     * when the owner chose to print it.
     *
     * @return array{hourly_rate: float|null, labor_billing: string, report_labor: string, business: array<string, mixed>}
     */
    public static function publicPayload(): array
    {
        $all = self::payload();

        return [
            'hourly_rate' => $all['report_labor'] === 'time' ? $all['hourly_rate'] : null,
            'labor_billing' => $all['labor_billing'],
            'report_labor' => $all['report_labor'],
            'business' => $all['business'],
        ];
    }

    /** @return array{hourly_rate: float, labor_billing: string, report_labor: string, business: array<string, mixed>} */
    public static function payload(): array
    {
        $values = Setting::query()
            ->whereIn('key', array_map(fn (string $k) => "business.$k", array_keys(self::BUSINESS_DEFAULTS)))
            ->pluck('value', 'key');

        $business = [];
        foreach (self::BUSINESS_DEFAULTS as $key => $default) {
            $business[$key] = $values["business.$key"] ?? $default;
        }
        $business['vat_payer'] = (bool) (int) $business['vat_payer'];

        return ['hourly_rate' => self::rate(), 'labor_billing' => self::laborBilling(), 'report_labor' => self::reportLabor(), 'business' => $business];
    }
}
