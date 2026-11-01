<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // People invited to send requests. A separate account table from the staff `users`: their tokens never open the shop's API.
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone', 32);
            $table->string('password');
            // The customer record their accepted requests are filed under, made on the first acceptance.
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // One-time registration links. Only a hash of the token is kept; the link is shown once when created.
        Schema::create('client_invites', function (Blueprint $table) {
            $table->id();
            $table->string('token_hash', 64)->unique();
            $table->string('note', 120)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('expires_at');
            $table->dateTime('used_at')->nullable();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->dateTime('revoked_at')->nullable();
            $table->timestamps();
        });

        // What a client sends: the car and what to do. It becomes a work order only when the shop accepts it.
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('plate', 16);
            $table->string('make', 64);
            $table->string('model', 128);
            $table->string('engine', 64)->nullable();
            $table->string('vin', 17)->nullable();
            $table->unsignedInteger('km')->nullable();
            $table->text('description');
            $table->date('preferred_date')->nullable();
            $table->json('photos')->nullable();
            $table->string('status', 16)->default('new')->index();
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reject_reason')->nullable();
            $table->dateTime('handled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_requests');
        Schema::dropIfExists('client_invites');
        Schema::dropIfExists('clients');
    }
};
