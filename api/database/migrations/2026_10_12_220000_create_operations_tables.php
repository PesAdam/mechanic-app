<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Catalogue of standard jobs with their norm time (normohodiny).
        Schema::create('operations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160)->unique();
            $table->string('category', 32)->default('ine');
            $table->unsignedSmallInteger('norm_minutes');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Jobs picked on one order; name and norm are snapshots so later catalogue edits don't rewrite history.
        Schema::create('order_operations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('operation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 160);
            $table->unsignedSmallInteger('norm_minutes');
            $table->boolean('done')->default(false);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        // Measured time per catalogue job, recorded when an order closes; feeds "your average".
        Schema::create('operation_samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('operation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('actual_seconds');
            $table->unsignedSmallInteger('norm_minutes');
            $table->dateTime('recorded_at');
            $table->timestamps();

            $table->index(['operation_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operation_samples');
        Schema::dropIfExists('order_operations');
        Schema::dropIfExists('operations');
    }
};
