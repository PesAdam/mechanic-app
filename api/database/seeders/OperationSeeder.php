<?php

namespace Database\Seeders;

use App\Models\Operation;
use Illuminate\Database\Seeder;

/**
 * Starting catalogue of common jobs with ORIENTAČNÉ norm times (minutes).
 * These are rough workshop averages, not manufacturer flat-rate data; tune them
 * in Nastavenia → Úkony or replace them with your supplier's norms.
 */
class OperationSeeder extends Seeder
{
    /** @var array<string, array<string, int>> */
    public const CATALOG = [
        'servis' => [
            'Výmena motorového oleja a olejového filtra' => 30,
            'Výmena vzduchového filtra' => 10,
            'Výmena kabínového filtra' => 15,
            'Výmena palivového filtra (diesel)' => 30,
            'Výmena brzdovej kvapaliny' => 40,
            'Výmena chladiacej kvapaliny' => 45,
            'Výmena stieračov' => 10,
            'Servisná prehliadka a reset intervalu' => 45,
            'Výmena zapaľovacích sviečok (4-valec)' => 40,
            'Výmena žeraviacich sviečok' => 60,
        ],
        'brzdy' => [
            'Výmena brzdových kotúčov a platničiek vpredu' => 90,
            'Výmena brzdových kotúčov a platničiek vzadu' => 100,
            'Výmena brzdových platničiek vpredu' => 45,
            'Výmena brzdových platničiek vzadu' => 50,
            'Výmena brzdových čeľustí (bubnové brzdy)' => 120,
            'Výmena brzdového strmeňa (1 ks)' => 60,
            'Odvzdušnenie bŕzd' => 30,
            'Výmena lanka ručnej brzdy' => 60,
        ],
        'motor' => [
            'Výmena rozvodového remeňa s vodným čerpadlom' => 240,
            'Výmena rozvodovej reťaze' => 420,
            'Výmena drážkového remeňa' => 40,
            'Výmena snímača EGR' => 60,
            'Čistenie EGR ventilu' => 90,
            'Výmena termostatu' => 60,
            'Výmena vodného čerpadla' => 150,
            'Výmena turbodúchadla' => 300,
            'Výmena vstrekovača (1 ks)' => 90,
            'Výmena tesnenia ventilového veka' => 60,
            'Výmena lôžka motora (1 ks)' => 60,
        ],
        'podvozok' => [
            'Výmena tlmičov vpredu (pár)' => 120,
            'Výmena tlmičov vzadu (pár)' => 90,
            'Výmena ramena nápravy (1 ks)' => 60,
            'Výmena čapu riadenia (1 ks)' => 30,
            'Výmena ložiska kolesa (1 ks)' => 60,
            'Výmena tyčiek stabilizátora (pár)' => 40,
            'Geometria náprav' => 60,
            'Prezutie pneumatík a vyváženie' => 40,
            'Výmena homokinetického kĺbu' => 90,
        ],
        'prevodovka' => [
            'Výmena spojky' => 300,
            'Výmena spojky s dvojhmotovým zotrvačníkom' => 360,
            'Výmena oleja v prevodovke' => 45,
        ],
        'elektro' => [
            'Výmena alternátora' => 90,
            'Výmena štartéra' => 90,
            'Výmena akumulátora' => 20,
            'Výmena žiarovky' => 10,
            'Výmena lambda sondy' => 40,
        ],
        'klima' => [
            'Plnenie klimatizácie' => 45,
            'Výmena kompresora klimatizácie' => 180,
        ],
        'diagnostika' => [
            'Diagnostika riadiacich jednotiek' => 30,
            'Skúšobná jazda' => 20,
            'Vyhľadanie poruchy (hodina)' => 60,
        ],
        'karoseria' => [
            'Výmena koncového dielu výfuku' => 45,
            'Výmena čelného skla' => 120,
        ],
    ];

    public function run(): void
    {
        foreach (self::CATALOG as $category => $jobs) {
            foreach ($jobs as $name => $minutes) {
                Operation::query()->firstOrCreate(['name' => $name], ['category' => $category, 'norm_minutes' => $minutes]);
            }
        }
    }
}
