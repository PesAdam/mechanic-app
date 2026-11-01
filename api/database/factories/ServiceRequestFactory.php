<?php

namespace Database\Factories;

use App\Enums\RequestStatus;
use App\Models\Client;
use App\Models\ServiceRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ServiceRequest>
 */
class ServiceRequestFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_id' => Client::factory(),
            'plate' => 'ZA'.fake()->numerify('###').'AB',
            'make' => 'Škoda',
            'model' => 'Octavia III',
            'engine' => '2.0 TDI',
            'km' => 180000,
            'description' => 'Výmena oleja a filtrov',
            'status' => RequestStatus::New,
        ];
    }
}
