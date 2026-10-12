<?php

namespace Database\Factories;

use App\Models\Operation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Operation>
 */
class OperationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Výmena '.fake()->unique()->word(),
            'category' => 'servis',
            'norm_minutes' => 60,
            'is_active' => true,
        ];
    }
}
