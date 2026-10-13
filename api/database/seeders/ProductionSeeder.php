<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Services\CarCatalog;
use Illuminate\Database\Seeder;

/** What a fresh real workshop needs: the job catalogue, the car catalogue and sane settings. No demo data. */
class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(OperationSeeder::class);
        CarCatalog::importDefaults();

        foreach (['hourly_rate' => 30, 'labor_billing' => 'actual'] as $key => $value) {
            if (Setting::get($key) === null) {
                Setting::set($key, $value);
            }
        }
    }
}
