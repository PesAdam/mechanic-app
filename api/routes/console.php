<?php

use App\Models\Operation;
use App\Models\User;
use App\Services\CarCatalog;
use Database\Seeders\OperationSeeder;
use Database\Seeders\ProductionSeeder;
use Illuminate\Support\Facades\Artisan;

/*
 * app:install – idempotent setup run on every deploy / container start:
 * migrations, catalogue seed on an empty database (or just the new catalogue jobs and
 * vehicles after an update) and the uploads symlink. Caches are warmed by the entrypoint.
 */
Artisan::command('app:install', function () {
    $this->call('migrate', ['--force' => true]);

    if (Operation::query()->count() === 0) {
        $this->call('db:seed', ['--class' => ProductionSeeder::class, '--force' => true]);
    } else {
        $this->call('db:seed', ['--class' => OperationSeeder::class, '--force' => true]);
        $this->info('Katalóg vozidiel: '.CarCatalog::importDefaults().' značiek.');
    }

    if (! is_link(public_path('storage'))) {
        $this->call('storage:link', ['--force' => true]);
    }

    $this->info('Aplikácia je pripravená.');
})->purpose('Migrácie, východiskové dáta a odkaz na uploady – bezpečné spustiť opakovane');

/*
 * app:owner – first (or reset) owner account; mechanics are then managed in the app.
 */
Artisan::command('app:owner {email} {name} {--password= : Heslo; bez voľby sa opýta}', function (string $email, string $name) {
    $password = $this->option('password') ?: $this->secret('Heslo majiteľa');
    if (strlen((string) $password) < 8) {
        $this->error('Heslo musí mať aspoň 8 znakov.');

        return 1;
    }

    $user = User::query()->updateOrCreate(['email' => $email], ['name' => $name, 'password' => $password, 'role' => 'owner', 'is_active' => true]);
    $this->info("Majiteľ {$user->name} <{$user->email}> je pripravený, prihlásenie na /login.");

    return 0;
})->purpose('Vytvorí alebo obnoví účet majiteľa');
