<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('car_models', function (Blueprint $table) {
            // Production years of the generation, e.g. "2012–2019"; free text, orientation only.
            $table->string('years', 16)->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('car_models', fn (Blueprint $t) => $t->dropColumn('years'));
    }
};
