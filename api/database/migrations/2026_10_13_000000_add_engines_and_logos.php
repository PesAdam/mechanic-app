<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('car_makes', function (Blueprint $table) {
            $table->string('slug', 64)->nullable()->after('name');
            $table->string('logo_url')->nullable()->after('slug');
        });

        // Motorizácia: the third level of the vehicle catalogue.
        Schema::create('car_engines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_model_id')->constrained()->cascadeOnDelete();
            $table->string('name', 64);
            $table->timestamps();

            $table->unique(['car_model_id', 'name']);
        });

        Schema::table('cars', function (Blueprint $table) {
            $table->foreignId('car_engine_id')->nullable()->after('car_model_id')->constrained()->nullOnDelete();
            $table->string('engine', 64)->nullable()->after('model');
        });

        Schema::table('operation_norms', function (Blueprint $table) {
            $table->foreignId('car_engine_id')->nullable()->after('car_model_id')->constrained()->cascadeOnDelete();
        });

        Schema::table('operation_samples', function (Blueprint $table) {
            $table->foreignId('car_engine_id')->nullable()->after('car_model_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('operation_samples', fn (Blueprint $t) => $t->dropConstrainedForeignId('car_engine_id'));
        Schema::table('operation_norms', fn (Blueprint $t) => $t->dropConstrainedForeignId('car_engine_id'));
        Schema::table('cars', function (Blueprint $table) {
            $table->dropConstrainedForeignId('car_engine_id');
            $table->dropColumn('engine');
        });
        Schema::dropIfExists('car_engines');
        Schema::table('car_makes', fn (Blueprint $t) => $t->dropColumn(['slug', 'logo_url']));
    }
};
