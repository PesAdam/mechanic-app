<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Models\Car;
use App\Models\Customer;
use App\Models\Operation;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/** Demo workshop: three mechanics and the four orders from the design mockups. */
class DatabaseSeeder extends Seeder
{
    public const PASSWORD = 'heslo1234';

    public function run(): void
    {
        $this->call(OperationSeeder::class);

        $adam = User::query()->create(['name' => 'Adam Belko', 'email' => 'adam@dielna.sk', 'password' => self::PASSWORD, 'role' => 'owner']);
        $marek = User::query()->create(['name' => 'Marek Kováčik', 'email' => 'marek@dielna.sk', 'password' => self::PASSWORD]);
        $tomas = User::query()->create(['name' => 'Tomáš Hudec', 'email' => 'tomas@dielna.sk', 'password' => self::PASSWORD]);

        Setting::set('hourly_rate', 28);
        foreach ([
            'name' => 'NÁZOV', 'owner' => 'Adam Belko', 'street' => 'Hôrky 134', 'city' => '010 04 Žilina',
            'phone' => '+421 9xx xxx xxx', 'email' => 'email@domena.sk', 'iban' => 'SK31 1200 0000 1987 4263 7541',
            'ico' => '00 000 000', 'vat_payer' => 0,
        ] as $key => $value) {
            Setting::set("business.$key", $value);
        }

        $today = CarbonImmutable::today();
        $at = fn (string $hhmm, int $daysAgo = 0) => $today->subDays($daysAgo)->setTimeFromTimeString($hhmm);

        // #0231 — Octavia, Adam clocked in 31 minutes ago
        $order = $this->order($adam, [
            'customer' => ['name' => 'Ján Kováč', 'phone' => '+421 905 123 456'],
            'car' => ['make' => 'Škoda', 'model' => 'Octavia III 2.0 TDI', 'plate' => 'ZA 412 KL', 'vin' => 'TMBJG7NE5J0114821', 'km' => 184230],
            'number' => '0231', 'summary' => 'Brzdy vpredu + snímač EGR', 'lift' => 'Zdvihák 1',
            'status' => OrderStatus::Open, 'received_at' => $at('09:40'),
        ]);
        $order->parts()->createMany([
            ['name' => 'Brzdové kotúče ATE 312 mm', 'meta' => '2 ks · 24.0112-0150.1', 'price' => 89.9, 'purchase_price' => 64.5, 'added_at' => $at('11:40')],
            ['name' => 'Brzdové platničky Brembo P85 075', 'meta' => '1 sada', 'price' => 54.2, 'purchase_price' => 38.9, 'added_at' => $at('11:40')],
            ['name' => 'Snímač EGR Pierburg 7.22818.56', 'meta' => '1 ks', 'price' => 112, 'purchase_price' => 84, 'added_at' => $at('11:40')],
            ['name' => 'Brzdová kvapalina DOT4', 'meta' => '0,5 l · neúčtované', 'price' => 9.8, 'purchase_price' => 6.2, 'used' => false, 'added_at' => $at('11:40')],
        ]);
        $order->photos()->createMany([
            ['label' => 'Auto zákazníka', 'stage' => 'pred', 'taken_at' => $at('09:40')],
            ['label' => 'Kotúč pred', 'stage' => 'pred', 'taken_at' => $at('09:50')],
            ['label' => 'EGR ventil', 'stage' => 'pred', 'taken_at' => $at('09:50')],
            ['label' => 'Kotúč po', 'stage' => 'po', 'taken_at' => $at('12:30')],
            ['label' => 'Nový snímač', 'stage' => 'po', 'taken_at' => $at('13:55')],
        ]);
        $order->diagnostic()->create(['file_name' => 'VCDS_octavia_0231.pdf', 'pages' => 6, 'imported_at' => $at('09:42')])
            ->codes()->createMany([
                ['code' => 'P0401', 'description' => 'Nedostatočný prietok recirkulácie výfukových plynov (EGR)', 'unit' => 'Motor · 01', 'status' => 'fixed'],
                ['code' => 'P2002', 'description' => 'Účinnosť filtra pevných častíc pod prahom', 'unit' => 'Motor · 01', 'status' => 'watch'],
            ]);
        $this->operations($order, ['Výmena brzdových kotúčov a platničiek vpredu', 'Výmena snímača EGR', 'Diagnostika riadiacich jednotiek', 'Skúšobná jazda']);
        $order->workEntries()->createMany([
            ['user_id' => $adam->id, 'started_at' => $at('10:05'), 'ended_at' => $at('11:35'), 'note' => 'Demontáž a výmena brzdových kotúčov a platničiek vpredu'],
            ['user_id' => $marek->id, 'started_at' => $at('13:10'), 'ended_at' => $at('14:00'), 'note' => 'Výmena snímača EGR, adaptácia riadiacej jednotky'],
            ['user_id' => $adam->id, 'started_at' => now()->subMinutes(31), 'note' => 'Diagnostika, skúšobná jazda, kontrola brzdného účinku'],
        ]);

        // #0232 — Passat, Marek clocked in 48 minutes ago
        $order = $this->order($marek, [
            'customer' => ['name' => 'Eva Hrušková', 'phone' => '+421 911 222 333'],
            'car' => ['make' => 'VW', 'model' => 'Passat B8 1.6 TDI', 'plate' => 'ZA 908 FT', 'vin' => 'WVWZZZ3CZJE051234', 'km' => 142870],
            'number' => '0232', 'summary' => 'Servisná prehliadka, olej + filtre', 'lift' => 'Zdvihák 2',
            'status' => OrderStatus::Open, 'received_at' => $at('12:30'),
        ]);
        $order->parts()->createMany([
            ['name' => 'Motorový olej Castrol Edge 5W-30 LL', 'meta' => '5 l', 'price' => 48.9, 'purchase_price' => 36.4, 'added_at' => $at('12:50')],
            ['name' => 'Olejový filter Mann HU 7020 z', 'meta' => '1 ks', 'price' => 12.4, 'purchase_price' => 8.1, 'added_at' => $at('12:50')],
            ['name' => 'Vzduchový filter Mann C 27 009', 'meta' => '1 ks', 'price' => 18.3, 'purchase_price' => 12.9, 'added_at' => $at('12:50')],
            ['name' => 'Kabínový filter Mann CUK 26 010', 'meta' => '1 ks', 'price' => 21, 'purchase_price' => 14.8, 'added_at' => $at('12:50')],
            ['name' => 'Palivový filter Mann PU 8028', 'meta' => '1 ks', 'price' => 42, 'purchase_price' => 31.5, 'added_at' => $at('12:50')],
        ]);
        $order->photos()->create(['label' => 'Auto zákazníka', 'stage' => 'pred', 'taken_at' => $at('12:32')]);
        $this->operations($order, ['Výmena motorového oleja a olejového filtra', 'Výmena vzduchového filtra', 'Výmena kabínového filtra', 'Výmena palivového filtra (diesel)']);
        $order->workEntries()->create(['user_id' => $marek->id, 'started_at' => now()->subMinutes(48)->subSeconds(12), 'note' => 'Výmena oleja a filtrov, kontrola podvozku']);

        // #0233 — BMW waiting for the clutch kit
        $order = $this->order(null, [
            'customer' => ['name' => 'Peter Lacko', 'phone' => '+421 902 555 777'],
            'car' => ['make' => 'BMW', 'model' => '320d F30', 'plate' => 'ZA 115 DK', 'vin' => 'WBA3D31050F123456', 'km' => 211400],
            'number' => '0233', 'summary' => 'Spojka', 'status' => OrderStatus::Waiting, 'received_at' => $at('14:00'),
        ]);
        $order->parts()->create(['name' => 'Spojková sada LuK 624 3277 00', 'meta' => '1 sada · objednané', 'price' => 389, 'purchase_price' => 312, 'added_at' => $at('08:15')]);

        // #0229 — Kia, finished two days ago, waiting for payment
        $order = $this->order($tomas, [
            'customer' => ['name' => 'Mária Vargová', 'phone' => '+421 948 101 202'],
            'car' => ['make' => 'Kia', 'model' => 'Ceed 1.4 CRDi', 'plate' => 'ZA 331 PE', 'vin' => 'U5YHN516AEL123456', 'km' => 96350],
            'number' => '0229', 'summary' => 'Olej, brzdová kvapalina, stierače',
            'status' => OrderStatus::Unpaid, 'received_at' => $at('08:30', 2), 'closed_at' => $at('11:20', 2),
        ]);
        $order->parts()->createMany([
            ['name' => 'Motorový olej Shell Helix 5W-30', 'meta' => '4 l', 'price' => 41.9, 'purchase_price' => 29.9, 'added_at' => $at('09:10', 2)],
            ['name' => 'Olejový filter Bosch F 026 407 072', 'meta' => '1 ks', 'price' => 14.5, 'purchase_price' => 9.9, 'added_at' => $at('09:10', 2)],
            ['name' => 'Brzdová kvapalina DOT4', 'meta' => '1 l', 'price' => 15, 'purchase_price' => 9.5, 'added_at' => $at('09:10', 2)],
            ['name' => 'Stierače Bosch Aerotwin A 414 S', 'meta' => '1 sada', 'price' => 25, 'purchase_price' => 17.4, 'added_at' => $at('09:10', 2)],
        ]);
        $order->photos()->create(['label' => 'Auto zákazníka', 'stage' => 'pred', 'taken_at' => $at('08:32', 2)]);
        $this->operations($order, ['Výmena motorového oleja a olejového filtra', 'Výmena brzdovej kvapaliny', 'Výmena stieračov'], done: true);
        $order->workEntries()->createMany([
            ['user_id' => $tomas->id, 'started_at' => $at('08:45', 2), 'ended_at' => $at('10:15', 2), 'note' => 'Výmena oleja a filtra, výmena brzdovej kvapaliny'],
            ['user_id' => $tomas->id, 'started_at' => $at('10:30', 2), 'ended_at' => $at('11:10', 2), 'note' => 'Výmena stieračov, kontrola osvetlenia, skúšobná jazda'],
        ]);
    }

    /** @param list<string> $names */
    private function operations(WorkOrder $order, array $names, bool $done = false): void
    {
        foreach ($names as $i => $name) {
            $op = Operation::query()->where('name', $name)->firstOrFail();
            $order->operations()->create(['operation_id' => $op->id, 'name' => $op->name, 'norm_minutes' => $op->norm_minutes, 'done' => $done, 'sort' => $i]);
        }
    }

    /** @param array<string, mixed> $data */
    private function order(?User $mechanic, array $data): WorkOrder
    {
        $customer = Customer::query()->create($data['customer']);
        $car = Car::query()->create([...$data['car'], 'customer_id' => $customer->id]);

        return WorkOrder::query()->create([
            'number' => $data['number'],
            'customer_id' => $customer->id,
            'car_id' => $car->id,
            'summary' => $data['summary'],
            'lift' => $data['lift'] ?? null,
            'status' => $data['status'],
            'mechanic_id' => $mechanic?->id,
            'received_at' => $data['received_at'],
            'closed_at' => $data['closed_at'] ?? null,
        ]);
    }
}
