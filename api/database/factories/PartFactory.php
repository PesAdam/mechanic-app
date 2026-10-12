<?php

namespace Database\Factories;

use App\Models\Part;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Part>
 */
class PartFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'work_order_id' => WorkOrder::factory(),
            'name' => 'Olejový filter',
            'meta' => '1 ks',
            'price' => 12.4,
            'purchase_price' => null,
            'used' => true,
            'added_at' => now(),
        ];
    }

    public function unused(): static
    {
        return $this->state(fn () => ['used' => false]);
    }
}
