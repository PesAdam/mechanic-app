<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A stint may be clocked against one job of the order; NULL is the plain order-level stopwatch.
        Schema::table('work_entries', function (Blueprint $table) {
            $table->foreignId('order_operation_id')->nullable()->after('user_id')->constrained('order_operations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('work_entries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('order_operation_id');
        });
    }
};
