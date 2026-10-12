<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkEntry>
 */
class WorkEntryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'work_order_id' => WorkOrder::factory(),
            'user_id' => User::factory(),
            'started_at' => now()->subHour(),
            'ended_at' => now(),
            'note' => null,
            'manual' => false,
        ];
    }

    public function running(): static
    {
        return $this->state(fn () => ['ended_at' => null]);
    }
}
