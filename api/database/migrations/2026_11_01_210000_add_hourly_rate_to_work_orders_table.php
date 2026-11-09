<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The hourly rate an order was taken at: changing the shop's rate later never reprices it.
        Schema::table('work_orders', function (Blueprint $table) {
            $table->decimal('hourly_rate', 8, 2)->nullable()->after('total_override');
        });

        // Orders from before this column were priced at the rate set until now.
        $rate = DB::table('settings')->where('key', 'hourly_rate')->value('value') ?? 28;
        DB::table('work_orders')->whereNull('hourly_rate')->update(['hourly_rate' => (float) $rate]);
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn('hourly_rate');
        });
    }
};
