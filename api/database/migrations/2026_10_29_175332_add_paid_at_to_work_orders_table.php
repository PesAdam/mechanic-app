<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // When the customer paid: zárobok is counted on this day, not on the day the order was closed.
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dateTime('paid_at')->nullable()->after('closed_at');

            $table->index('paid_at');
        });

        // Orders marked paid before this column existed: the closing day is the best guess there is.
        DB::table('work_orders')->where('status', 'done')->update(['paid_at' => DB::raw('COALESCE(closed_at, updated_at)')]);
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropIndex(['paid_at']);
            $table->dropColumn('paid_at');
        });
    }
};
