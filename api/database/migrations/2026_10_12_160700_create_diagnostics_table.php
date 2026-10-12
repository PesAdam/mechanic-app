<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagnostics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_path')->nullable();
            $table->unsignedSmallInteger('pages')->default(0);
            $table->dateTime('imported_at');
            $table->timestamps();
        });

        Schema::create('diag_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('diagnostic_id')->constrained()->cascadeOnDelete();
            $table->string('code', 16);
            $table->string('description')->nullable();
            $table->string('unit', 64)->nullable();
            $table->string('status', 8)->default('open');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diag_codes');
        Schema::dropIfExists('diagnostics');
    }
};
