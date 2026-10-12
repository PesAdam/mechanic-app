<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Car;
use App\Models\Customer;
use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkOrder>
 */
class WorkOrderFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'customer_id' => Customer::factory(),
            'car_id' => fn (array $attributes) => Car::factory()->create(['customer_id' => $attributes['customer_id']])->id,
            'summary' => 'Servisná prehliadka',
            'status' => OrderStatus::New,
            'parts_pricing' => 'moc',
            'received_at' => now(),
        ];
    }

    public function open(): static
    {
        return $this->state(fn () => ['status' => OrderStatus::Open]);
    }

    public function unpaid(): static
    {
        return $this->state(fn () => ['status' => OrderStatus::Unpaid, 'closed_at' => now()]);
    }
}
