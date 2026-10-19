<?php

namespace Tests\Feature\Api;

use App\Models\CarEngine;
use App\Models\CarMake;
use App\Models\CarModel;
use App\Models\Operation;
use App\Models\OperationNorm;
use App\Models\OperationSample;
use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VehicleNormTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_new_order_files_its_car_under_make_and_model(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/orders', [
            'customer' => ['name' => 'Ján Kováč'],
            'car' => ['make' => 'škoda', 'model' => 'Octavia III', 'plate' => 'ZA 412 KL'],
            'summary' => 'Brzdy',
        ])->assertCreated()->assertJsonPath('data.car.make', 'škoda');

        $this->postJson('/api/v1/orders', [
            'customer' => ['name' => 'Eva Nová'],
            'car' => ['make' => 'Škoda', 'model' => 'octavia iii', 'plate' => 'ZA 1 AA'],
            'summary' => 'Olej',
        ])->assertCreated();

        $this->assertDatabaseCount('car_makes', 1);
        $this->assertDatabaseCount('car_models', 1);
        $this->assertSame(2, CarModel::query()->first()->cars()->count());
    }

    public function test_model_norm_wins_over_make_norm_and_default(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $make = CarMake::query()->create(['name' => 'Škoda']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => 'Octavia III']);
        $job = Operation::factory()->create(['norm_minutes' => 90]);
        OperationNorm::query()->create(['operation_id' => $job->id, 'car_make_id' => $make->id, 'car_model_id' => null, 'norm_minutes' => 95]);
        OperationNorm::query()->create(['operation_id' => $job->id, 'car_make_id' => $make->id, 'car_model_id' => $model->id, 'norm_minutes' => 100]);
        $order = WorkOrder::factory()->open()->create();
        $order->car->update(['car_model_id' => $model->id]);

        $response = $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $job->id]);

        $response->assertOk()->assertJsonPath('data.operations.0.norm_minutes', 100);
        $this->getJson("/api/v1/operations?car_model_id={$model->id}")
            ->assertOk()
            ->assertJsonFragment(['id' => $job->id, 'car_norm_minutes' => 100, 'car_norm_source' => 'model']);
    }

    public function test_engine_norm_wins_over_model_norm(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $make = CarMake::query()->create(['name' => 'Škoda']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => 'Octavia III']);
        $engine = CarEngine::query()->create(['car_model_id' => $model->id, 'name' => '2.0 TDI']);
        $job = Operation::factory()->create(['norm_minutes' => 90]);
        OperationNorm::query()->create(['operation_id' => $job->id, 'car_make_id' => $make->id, 'car_model_id' => $model->id, 'norm_minutes' => 100]);
        OperationNorm::query()->create(['operation_id' => $job->id, 'car_make_id' => $make->id, 'car_model_id' => $model->id, 'car_engine_id' => $engine->id, 'norm_minutes' => 110]);
        $order = WorkOrder::factory()->open()->create();
        $order->car->update(['car_model_id' => $model->id, 'car_engine_id' => $engine->id]);

        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $job->id])
            ->assertOk()
            ->assertJsonPath('data.operations.0.norm_minutes', 110);
        $this->getJson("/api/v1/operations?car_model_id={$model->id}&car_engine_id={$engine->id}")
            ->assertJsonFragment(['id' => $job->id, 'car_norm_minutes' => 110, 'car_norm_source' => 'engine']);
    }

    public function test_new_order_with_engine_files_it_under_the_model(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/v1/orders', [
            'customer' => ['name' => 'Ján Kováč'],
            'car' => ['make' => 'Škoda', 'model' => 'Octavia III', 'engine' => '2.0 TDI', 'plate' => 'ZA 412 KL'],
            'summary' => 'Brzdy',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.car.engine', '2.0 TDI')
            ->assertJsonPath('data.car.logo_url', 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/thumb/skoda.png');
        $this->assertDatabaseHas('car_engines', ['name' => '2.0 TDI']);
    }

    public function test_bundled_catalogue_import_is_idempotent(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/car-makes/import-defaults')->assertOk();
        $first = CarEngine::query()->count();
        $this->postJson('/api/v1/car-makes/import-defaults')->assertOk();

        $this->assertSame($first, CarEngine::query()->count());
        $this->assertDatabaseHas('car_makes', ['name' => 'Škoda', 'slug' => 'skoda']);
    }

    public function test_make_norm_applies_to_models_without_their_own(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $make = CarMake::query()->create(['name' => 'BMW']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => '320d F30']);
        $job = Operation::factory()->create(['norm_minutes' => 90]);
        $order = WorkOrder::factory()->open()->create();
        $order->car->update(['car_model_id' => $model->id]);

        $this->postJson("/api/v1/operations/{$job->id}/norms", ['car_make_id' => $make->id, 'norm_minutes' => 120])
            ->assertOk()
            ->assertJsonPath('data.norms.0.car_make', 'BMW')
            ->assertJsonPath('data.norms.0.car_model', null);

        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $job->id])
            ->assertOk()
            ->assertJsonPath('data.operations.0.norm_minutes', 120);
    }

    public function test_closing_records_samples_per_model(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $make = CarMake::query()->create(['name' => 'Kia']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => 'Ceed']);
        $job = Operation::factory()->create(['norm_minutes' => 60]);
        $order = WorkOrder::factory()->open()->create();
        $order->car->update(['car_model_id' => $model->id]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $job->id]);
        WorkEntry::factory()->for($order)->for($user)->create(['started_at' => now()->subMinutes(45), 'ended_at' => now()]);

        $this->postJson("/api/v1/orders/{$order->id}/close")->assertOk();

        $this->assertDatabaseHas('operation_samples', ['operation_id' => $job->id, 'car_model_id' => $model->id, 'actual_seconds' => 2700]);
        $this->getJson("/api/v1/operations?car_model_id={$model->id}")
            ->assertJsonFragment(['id' => $job->id, 'car_avg_seconds' => 2700, 'car_samples_count' => 1]);
    }

    public function test_make_level_lookup_resolves_make_norms_and_counts_usage(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $make = CarMake::query()->create(['name' => 'Opel']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => 'Astra K']);
        $job = Operation::factory()->create(['norm_minutes' => 90]);
        $norm = OperationNorm::query()->create(['operation_id' => $job->id, 'car_make_id' => $make->id, 'norm_minutes' => 80]);
        WorkOrder::factory()->create()->car->update(['car_model_id' => $model->id]);

        $this->getJson("/api/v1/operations?car_make_id={$make->id}")
            ->assertOk()
            ->assertJsonFragment(['id' => $job->id, 'car_norm_minutes' => 80, 'car_norm_source' => 'make', 'car_norm_id' => $norm->id]);
        $this->getJson('/api/v1/car-makes')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Opel', 'cars_count' => 1]);
    }

    public function test_lookup_finds_a_car_from_history_by_plate_ignoring_spaces(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();
        $order->car->update(['plate' => 'ZA 412 KL', 'vin' => 'TMBJG7NE5J0114821']);

        $response = $this->getJson('/api/v1/vehicles/lookup?q=za412kl');

        $response->assertOk()
            ->assertJsonPath('matches.0.car.plate', 'ZA 412 KL')
            ->assertJsonPath('matches.0.orders_count', 1)
            ->assertJsonPath('matches.0.customer.name', $order->customer->name);
    }

    public function test_lookup_decodes_make_and_model_year_from_a_vin(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->getJson('/api/v1/vehicles/lookup?q=TMBJG7NE5J0114821');

        $response->assertOk()
            ->assertJsonPath('vin.valid', true)
            ->assertJsonPath('vin.make', 'Škoda')
            ->assertJsonPath('vin.year', 2018)
            ->assertJsonPath('vin.models.0.name', 'Octavia III')
            ->assertJsonPath('vin.models.0.car_model_id', null);
    }

    public function test_vin_generation_is_matched_to_the_catalogue(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/v1/car-makes/import-defaults')->assertOk();
        $octavia = CarModel::query()->where('name', 'Octavia III')->firstOrFail();

        $this->getJson('/api/v1/vehicles/lookup?q=TMBJG7NE5J0114821')
            ->assertOk()
            ->assertJsonPath('vin.car_make_id', $octavia->car_make_id)
            ->assertJsonPath('vin.models.0.car_model_id', $octavia->id)
            ->assertJsonPath('vin.models.0.years', '2012–2020');
    }

    public function test_vin_decoder_covers_other_makers_schemes(): void
    {
        Sanctum::actingAs(User::factory()->create());

        // Mercedes: series at 4–6, char 10 is the steering code, so no year.
        $this->getJson('/api/v1/vehicles/lookup?q=WDD2050041R123456')->assertJsonPath('vin.make', 'Mercedes-Benz')->assertJsonPath('vin.models.0.name', 'C (W205)')->assertJsonPath('vin.year', null);
        // Passat 3C: the year decides B6 vs B7.
        $this->getJson('/api/v1/vehicles/lookup?q=WVWZZZ3CZCE123456')->assertJsonPath('vin.models.0.name', 'Passat B7');
        // Cupra shares Seat's WMI; the model code moves it to its own make.
        $this->getJson('/api/v1/vehicles/lookup?q=VSSZZZKMZM1234567')->assertJsonPath('vin.make', 'Cupra')->assertJsonPath('vin.models.0.name', 'Formentor');
        // Ambiguous code: both generations are offered.
        $this->getJson('/api/v1/vehicles/lookup?q=VF1BR1B0H12345678')->assertJsonPath('vin.models.0.name', 'Clio III');
        $this->getJson('/api/v1/vehicles/lookup?q=TMBZZZNWZL1234567')->assertJsonPath('vin.models.0.name', 'Scala')->assertJsonPath('vin.models.1.name', 'Kamiq');
        // Shared VW codes: Golf IV / Bora, and a year split that ends in candidates (Tiguan II / Allspace).
        $this->getJson('/api/v1/vehicles/lookup?q=WVWZZZ1JZ3W123456')->assertJsonPath('vin.models.0.name', 'Golf IV')->assertJsonPath('vin.models.1.name', 'Bora');
        $this->getJson('/api/v1/vehicles/lookup?q=WVGZZZ5NZKW123456')->assertJsonPath('vin.models.0.name', 'Tiguan II')->assertJsonPath('vin.models.1.name', 'Tiguan Allspace');
        // Renault: three-letter code first (Twingo I), then two-letter (Kangoo II); no year either way.
        $this->getJson('/api/v1/vehicles/lookup?q=VF1C0660512345678')->assertJsonPath('vin.models.0.name', 'Twingo I');
        $this->getJson('/api/v1/vehicles/lookup?q=VF1KW0AB512345678')->assertJsonPath('vin.models.0.name', 'Kangoo II')->assertJsonPath('vin.year', null);
        // Audi: A6 C7 and A7 share 4G.
        $this->getJson('/api/v1/vehicles/lookup?q=WAUZZZ4G0EN123456')->assertJsonPath('vin.models.0.name', 'A6 (C7)')->assertJsonPath('vin.models.1.name', 'A7 (4G)');
        // Unknown maker: valid VIN, nothing more.
        $this->getJson('/api/v1/vehicles/lookup?q=ABC12345678901234')->assertJsonPath('vin.valid', true)->assertJsonPath('vin.make', null)->assertJsonPath('vin.models', []);
    }

    public function test_vin_decoder_knows_the_infiniti_g37(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/v1/car-makes/import-defaults')->assertOk();

        // JNK = Infiniti passenger car built in Japan, CV6 = G37 sedan, char 10 "9" = model year 2009.
        $this->getJson('/api/v1/vehicles/lookup?q=JNKCV61E29M300882')
            ->assertOk()
            ->assertJsonPath('vin.make', 'Infiniti')
            ->assertJsonPath('vin.year', 2009)
            ->assertJsonPath('vin.models.0.name', 'G37 (V36)')
            ->assertJsonPath('vin.models.0.years', '2007–2013');
        $this->assertDatabaseHas('car_makes', ['name' => 'Infiniti', 'slug' => 'infiniti']);
    }

    public function test_new_order_for_a_known_car_reuses_the_car_and_customer(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $previous = WorkOrder::factory()->create();
        $previous->car->update(['km' => 120000]);

        $response = $this->postJson('/api/v1/orders', [
            'customer' => ['name' => $previous->customer->name, 'phone' => '0900 111 222'],
            'car' => ['id' => $previous->car_id, 'make' => $previous->car->make, 'model' => $previous->car->model, 'plate' => $previous->car->plate, 'km' => 125000],
            'summary' => 'Výmena oleja',
        ]);

        $response->assertCreated()->assertJsonPath('data.car.id', $previous->car_id);
        $this->assertDatabaseCount('cars', 1);
        $this->assertDatabaseCount('customers', 1);
        $this->assertSame(125000, $previous->car->fresh()->km);
        $this->assertSame('0900 111 222', $previous->customer->fresh()->phone);
    }

    public function test_lookup_leaves_year_unknown_for_makers_that_do_not_encode_it(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/vehicles/lookup?q=VF1RJA00X59876543')
            ->assertOk()
            ->assertJsonPath('vin.make', 'Renault')
            ->assertJsonPath('vin.year', null);
    }

    public function test_catalogue_import_keeps_catalogue_names_that_prefix_another_model(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/car-makes/import-defaults')->assertOk();
        $this->postJson('/api/v1/car-makes/import-defaults')->assertOk();

        // "Q8" prefixes "Q8 e-tron" and "Rapid" could prefix a later name: both are catalogue entries and must survive.
        $audi = CarMake::query()->where('name', 'Audi')->firstOrFail();
        $this->assertDatabaseHas('car_models', ['car_make_id' => $audi->id, 'name' => 'Q8']);
        $this->assertDatabaseHas('car_models', ['car_make_id' => $audi->id, 'name' => 'Q8 e-tron']);
        $vw = CarMake::query()->where('name', 'Volkswagen')->firstOrFail();
        $this->assertGreaterThanOrEqual(60, $vw->models()->count());
        $this->assertDatabaseHas('car_models', ['car_make_id' => $vw->id, 'name' => 'Golf Plus']);
    }

    public function test_catalogue_import_adds_years_and_drops_unused_generic_models(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $make = CarMake::query()->create(['name' => 'Renault']);
        CarModel::query()->create(['car_make_id' => $make->id, 'name' => 'Clio']);

        $this->postJson('/api/v1/car-makes/import-defaults')->assertOk();

        $this->assertDatabaseHas('car_models', ['car_make_id' => $make->id, 'name' => 'Clio IV', 'years' => '2012–2019']);
        $this->assertDatabaseMissing('car_models', ['car_make_id' => $make->id, 'name' => 'Clio']);
    }

    public function test_make_with_cars_cannot_be_deleted(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $make = CarMake::query()->create(['name' => 'Kia']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => 'Ceed']);
        WorkOrder::factory()->create()->car->update(['car_model_id' => $model->id]);

        $this->deleteJson("/api/v1/car-makes/{$make->id}")->assertConflict();
        $this->assertDatabaseHas('car_makes', ['id' => $make->id]);
    }

    public function test_default_norm_is_scaled_to_the_cars_difficulty(): void
    {
        Sanctum::actingAs(User::factory()->create());
        [$model, $engine] = $this->mazda6();
        $oil = Operation::factory()->create(['category' => 'servis', 'norm_minutes' => 60]);
        $chain = Operation::factory()->create(['category' => 'motor', 'norm_minutes' => 300]);
        $test = Operation::factory()->create(['category' => 'diagnostika', 'norm_minutes' => 30]);

        // The owner's own example: 1 h on an Octavia I is 1 h 10 min on a Mazda 6 (GH).
        $this->getJson("/api/v1/operations?car_model_id={$model->id}")
            ->assertJsonFragment(['id' => $oil->id, 'car_norm_minutes' => 70, 'car_norm_source' => 'vehicle'])
            ->assertJsonFragment(['id' => $test->id, 'car_norm_minutes' => 30, 'car_norm_source' => 'default']);
        // Engine jobs also follow the engine: 300 × 1.15 (model) × 1.10 (2.2 MZR-CD) ≈ 380.
        $this->getJson("/api/v1/operations?car_model_id={$model->id}&car_engine_id={$engine->id}")
            ->assertJsonFragment(['id' => $chain->id, 'car_norm_minutes' => 380, 'car_norm_source' => 'vehicle']);

        $order = WorkOrder::factory()->open()->create();
        $order->car->update(['car_model_id' => $model->id, 'car_engine_id' => $engine->id]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $oil->id])
            ->assertJsonPath('data.operations.0.norm_minutes', 70);
    }

    public function test_a_car_outside_the_catalogue_keeps_the_default_norm(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $make = CarMake::query()->create(['name' => 'Mazda']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => 'Vlastný model']);
        $job = Operation::factory()->create(['category' => 'servis', 'norm_minutes' => 60]);

        $this->getJson("/api/v1/operations?car_model_id={$model->id}")
            ->assertJsonFragment(['id' => $job->id, 'car_norm_minutes' => 60, 'car_norm_source' => 'default']);
    }

    public function test_a_norm_corrected_on_an_order_is_remembered_for_the_model(): void
    {
        Sanctum::actingAs(User::factory()->create());
        [$model, $engine] = $this->mazda6();
        $oil = Operation::factory()->create(['category' => 'servis', 'norm_minutes' => 60]);
        $belt = Operation::factory()->create(['category' => 'motor', 'norm_minutes' => 240]);
        $order = WorkOrder::factory()->open()->create();
        $order->car->update(['car_model_id' => $model->id, 'car_engine_id' => $engine->id]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $oil->id])->assertOk();
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $belt->id])->assertOk();
        [$oilJob, $beltJob] = $order->operations()->orderBy('sort')->get();

        $this->patchJson("/api/v1/order-operations/{$oilJob->id}", ['norm_minutes' => 75])->assertOk();
        $this->patchJson("/api/v1/order-operations/{$beltJob->id}", ['norm_minutes' => 330])->assertOk();

        $this->assertDatabaseHas('operation_norms', ['operation_id' => $oil->id, 'car_model_id' => $model->id, 'car_engine_id' => null, 'norm_minutes' => 75]);
        $this->assertDatabaseHas('operation_norms', ['operation_id' => $belt->id, 'car_model_id' => $model->id, 'car_engine_id' => $engine->id, 'norm_minutes' => 330]);
        $next = WorkOrder::factory()->open()->create();
        $next->car->update(['car_model_id' => $model->id]);
        $this->postJson("/api/v1/orders/{$next->id}/operations", ['operation_id' => $oil->id])
            ->assertJsonPath('data.operations.0.norm_minutes', 75);
    }

    public function test_duplicate_jobs_are_merged_and_generic_names_made_specific(): void
    {
        $old = Operation::factory()->create(['name' => 'Výmena kompresora klimatizácie', 'norm_minutes' => 180]);
        $kept = Operation::factory()->create(['name' => 'Výmena kompresora klimatizácie s preplachom okruhu a plnením', 'norm_minutes' => 240]);
        $clutch = Operation::factory()->create(['name' => 'Výmena spojky']);
        $order = WorkOrder::factory()->open()->create();
        $job = $order->operations()->create(['operation_id' => $old->id, 'name' => $old->name, 'norm_minutes' => 180]);
        OperationSample::query()->create(['operation_id' => $old->id, 'work_order_id' => $order->id, 'actual_seconds' => 9000, 'norm_minutes' => 180, 'recorded_at' => now()]);

        (require database_path('migrations/2026_10_19_120000_merge_duplicate_operations.php'))->up();

        $this->assertModelMissing($old);
        $this->assertSame($kept->id, $job->fresh()->operation_id);
        $this->assertSame('Výmena kompresora klimatizácie', $job->fresh()->name);
        $this->assertSame(1, OperationSample::query()->where('operation_id', $kept->id)->count());
        $this->assertSame('Výmena spojky (predný náhon)', $clutch->fresh()->name);
    }

    /** @return array{CarModel, CarEngine} */
    private function mazda6(): array
    {
        $make = CarMake::query()->create(['name' => 'Mazda']);
        $model = CarModel::query()->create(['car_make_id' => $make->id, 'name' => '6 (GH)']);

        return [$model, CarEngine::query()->create(['car_model_id' => $model->id, 'name' => '2.2 MZR-CD'])];
    }
}
