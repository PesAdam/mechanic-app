<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cars', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('make', 64);
            $table->string('model', 128);
            $table->string('plate', 16);
            $table->string('vin', 17)->nullable();
            $table->unsignedInteger('km')->default(0);
            $table->timestamps();

            $table->index('plate');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cars');
    }
};
