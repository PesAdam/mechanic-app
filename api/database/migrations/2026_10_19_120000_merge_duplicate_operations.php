<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Jobs that were in the catalogue twice: the first name goes, its orders, samples and vehicle norms move to the second. */
    public const MERGES = [
        'Výmena motorového oleja a olejového filtra (s demontážou krytu motora)' => 'Výmena motorového oleja a olejového filtra',
        'Servisná prehliadka a reset intervalu' => 'Malá servisná prehliadka (olej, olejový filter, kontrola vozidla)',
        'Výmena rozvodovej reťaze' => 'Výmena rozvodovej reťaze (4-valec, reťaz na prednej strane motora)',
        'Výmena snímača EGR' => 'Výmena EGR ventilu',
        'Výmena žiarovky' => 'Výmena žiarovky svetlometu H7 (prístup z motorového priestoru, 1 ks)',
        'Výmena kompresora klimatizácie' => 'Výmena kompresora klimatizácie s preplachom okruhu a plnením',
    ];

    /** Original generic names that read like duplicates of the specific variants added later. */
    public const RENAMES = [
        'Výmena brzdových čeľustí (bubnové brzdy)' => 'Výmena brzdových čeľustí vzadu (bubnové brzdy, sada)',
        'Výmena brzdového strmeňa (1 ks)' => 'Výmena brzdového strmeňa vpredu (1 ks)',
        'Výmena lanka ručnej brzdy' => 'Výmena lanka ručnej brzdy (1 ks)',
        'Výmena rozvodového remeňa s vodným čerpadlom' => 'Výmena rozvodového remeňa s vodným čerpadlom (4-valec)',
        'Výmena vstrekovača (1 ks)' => 'Výmena vstrekovača (1 ks, common rail diesel)',
        'Výmena ramena nápravy (1 ks)' => 'Výmena ramena prednej nápravy (1 ks)',
        'Výmena ložiska kolesa (1 ks)' => 'Výmena ložiska kolesa vpredu (náboj s ložiskom, 1 ks)',
        'Geometria náprav' => 'Geometria oboch náprav (meranie a nastavenie)',
        'Prezutie pneumatík a vyváženie' => 'Prezutie pneumatík s vyvážením (4 ks, do 17")',
        'Výmena homokinetického kĺbu' => 'Výmena vonkajšieho homokinetického kĺbu (1 ks)',
        'Výmena spojky' => 'Výmena spojky (predný náhon)',
        'Výmena spojky s dvojhmotovým zotrvačníkom' => 'Výmena spojky s dvojhmotovým zotrvačníkom (predný náhon)',
        'Výmena oleja v prevodovke' => 'Výmena oleja v manuálnej prevodovke',
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            foreach (self::MERGES + self::RENAMES as $from => $to) {
                $fromId = DB::table('operations')->where('name', $from)->value('id');
                if ($fromId === null) {
                    continue;
                }
                $toId = DB::table('operations')->where('name', $to)->value('id');
                if ($toId === null) {
                    DB::table('operations')->where('id', $fromId)->update(['name' => $to]);

                    continue;
                }
                self::merge($fromId, $toId);
            }
        });
    }

    public function down(): void
    {
        // Merged jobs cannot be split again; the names are only labels.
    }

    /** Orders keep their own copy of the job name, so history reads the same after the merge. */
    private static function merge(int $fromId, int $toId): void
    {
        DB::table('order_operations')->where('operation_id', $fromId)->update(['operation_id' => $toId]);
        DB::table('operation_samples')->where('operation_id', $fromId)->update(['operation_id' => $toId]);

        foreach (DB::table('operation_norms')->where('operation_id', $fromId)->get() as $norm) {
            $taken = DB::table('operation_norms')->where('operation_id', $toId)
                ->where('car_make_id', $norm->car_make_id)
                ->where('car_model_id', $norm->car_model_id)
                ->where('car_engine_id', $norm->car_engine_id)
                ->exists();
            if (! $taken) {
                DB::table('operation_norms')->where('id', $norm->id)->update(['operation_id' => $toId]);
            }
        }

        DB::table('operations')->where('id', $fromId)->delete();
    }
};
