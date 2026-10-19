<?php

namespace Tests\Feature;

use App\Models\Operation;
use App\Models\Setting;
use Database\Seeders\OperationSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class OperationSeederTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_seeder_adds_the_catalogue_once_and_respects_a_deleted_job(): void
    {
        $this->seed(OperationSeeder::class);
        $total = Operation::query()->count();
        $this->assertSame(count(OperationSeeder::names()), $total);
        $this->assertDatabaseHas('operations', ['name' => 'Výmena brzdových platničiek vpredu', 'category' => 'brzdy']);

        // The shop deletes a job it never does and tunes another one: the next deploy keeps both decisions.
        Operation::query()->where('name', 'Výmena čelného skla')->delete();
        Operation::query()->where('name', 'Výmena spojky')->update(['norm_minutes' => 333]);

        $this->seed(OperationSeeder::class);

        $this->assertSame($total - 1, Operation::query()->count());
        $this->assertDatabaseMissing('operations', ['name' => 'Výmena čelného skla']);
        $this->assertDatabaseHas('operations', ['name' => 'Výmena spojky', 'norm_minutes' => 333]);
    }

    public function test_seeder_adds_jobs_that_are_new_to_an_existing_install(): void
    {
        // An older install knows only part of today's catalogue.
        Operation::query()->create(['name' => 'Výmena spojky', 'category' => 'prevodovka', 'norm_minutes' => 300]);
        Setting::set(OperationSeeder::SEEDED_KEY, json_encode(['Výmena spojky', 'Výmena čelného skla']));

        $this->seed(OperationSeeder::class);

        $this->assertDatabaseHas('operations', ['name' => 'Výmena brzdových platničiek vpredu']);
        $this->assertDatabaseMissing('operations', ['name' => 'Výmena čelného skla']); // offered before, deleted since: stays gone
        $this->assertSame(1, Operation::query()->where('name', 'Výmena spojky')->count());
        $this->assertContains('Výmena brzdových platničiek vpredu', json_decode((string) Setting::get(OperationSeeder::SEEDED_KEY), true));
    }

    public function test_first_run_on_an_upgraded_install_does_not_bring_back_deleted_jobs(): void
    {
        // An install from before the expansion: the old catalogue minus a job the shop deleted, and no seeding record yet.
        Operation::query()->create(['name' => 'Výmena spojky', 'category' => 'prevodovka', 'norm_minutes' => 300]);

        $this->seed(OperationSeeder::class);

        $this->assertDatabaseMissing('operations', ['name' => 'Výmena čelného skla']); // an old job, deleted on purpose
        $this->assertDatabaseHas('operations', ['name' => 'Výmena brzdových platničiek vzadu (elektrická parkovacia brzda)']); // new in the expansion
        $this->assertSame(1, Operation::query()->where('name', 'Výmena spojky')->count());
    }
}
