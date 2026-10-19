<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Existing catalogue jobs that belong in the categories added with the bigger catalogue. */
    private const MOVES = [
        'Prezutie pneumatík a vyváženie' => 'pneu',
        'Výmena koncového dielu výfuku' => 'vyfuk',
        'Výmena lambda sondy' => 'vyfuk',
        'Výmena čapu riadenia (1 ks)' => 'riadenie',
        'Geometria náprav' => 'riadenie',
        'Výmena termostatu' => 'chladenie',
        'Výmena vodného čerpadla' => 'chladenie',
        'Výmena chladiacej kvapaliny' => 'chladenie',
        'Výmena žiarovky' => 'osvetlenie',
    ];

    public function up(): void
    {
        foreach (self::MOVES as $name => $category) {
            DB::table('operations')->where('name', $name)->update(['category' => $category]);
        }
    }

    public function down(): void
    {
        // The category is a shelf label; the old one is not worth restoring.
    }
};
