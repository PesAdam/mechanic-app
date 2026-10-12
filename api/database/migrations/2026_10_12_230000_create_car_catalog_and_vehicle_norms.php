<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_makes', function (Blueprint $table) {
            $table->id();
            $table->string('name', 64)->unique();
            $table->timestamps();
        });

        Schema::create('car_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_make_id')->constrained()->cascadeOnDelete();
            $table->string('name', 128);
            $table->timestamps();

            $table->unique(['car_make_id', 'name']);
        });

        Schema::table('cars', function (Blueprint $table) {
            $table->foreignId('car_model_id')->nullable()->after('customer_id')->constrained()->nullOnDelete();
        });

        // A job's norm for one make (car_model_id NULL) or one model; the operation's own norm is the fallback.
        Schema::create('operation_norms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('car_make_id')->constrained()->cascadeOnDelete();
            $table->foreignId('car_model_id')->nullable()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('norm_minutes');
            $table->timestamps();

            $table->index(['operation_id', 'car_make_id', 'car_model_id']);
        });

        Schema::table('operation_samples', function (Blueprint $table) {
            $table->foreignId('car_model_id')->nullable()->after('work_order_id')->constrained()->nullOnDelete();
        });

        // Backfill the catalogue from cars that already exist.
        foreach (DB::table('cars')->get() as $car) {
            $makeId = DB::table('car_makes')->where('name', $car->make)->value('id')
                ?? DB::table('car_makes')->insertGetId(['name' => $car->make, 'created_at' => now(), 'updated_at' => now()]);
            $modelId = DB::table('car_models')->where('car_make_id', $makeId)->where('name', $car->model)->value('id')
                ?? DB::table('car_models')->insertGetId(['car_make_id' => $makeId, 'name' => $car->model, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('cars')->where('id', $car->id)->update(['car_model_id' => $modelId]);
        }
    }

    public function down(): void
    {
        Schema::table('operation_samples', function (Blueprint $table) {
            $table->dropConstrainedForeignId('car_model_id');
        });
        Schema::dropIfExists('operation_norms');
        Schema::table('cars', function (Blueprint $table) {
            $table->dropConstrainedForeignId('car_model_id');
        });
        Schema::dropIfExists('car_models');
        Schema::dropIfExists('car_makes');
    }
};
