<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // "jobs" is taken by the queue table, so a zákazka is a work order.
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->string('number', 8)->unique();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('car_id')->constrained()->restrictOnDelete();
            $table->string('summary');
            $table->string('lift', 32)->nullable();
            $table->string('status', 16)->default('new');
            $table->foreignId('mechanic_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('received_at')->nullable();
            $table->dateTime('closed_at')->nullable();
            $table->uuid('public_token')->unique();
            $table->timestamps();

            $table->index(['status', 'received_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_orders');
    }
};
