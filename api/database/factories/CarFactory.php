<?php

namespace Database\Factories;

use App\Models\Car;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Car>
 */
class CarFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'make' => 'Škoda',
            'model' => 'Octavia III 2.0 TDI',
            'plate' => mb_strtoupper(fake()->bothify('ZA ### ??')),
            'vin' => null,
            'km' => fake()->numberBetween(10000, 250000),
        ];
    }
}
