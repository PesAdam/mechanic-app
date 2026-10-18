<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // When the shop plans to work on the order and for how long (minutes; NULL = the norm sum).
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dateTime('planned_at')->nullable()->after('received_at');
            $table->unsignedSmallInteger('planned_minutes')->nullable()->after('planned_at');

            $table->index('planned_at');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropIndex(['planned_at']);
            $table->dropColumn(['planned_at', 'planned_minutes']);
        });
    }
};
