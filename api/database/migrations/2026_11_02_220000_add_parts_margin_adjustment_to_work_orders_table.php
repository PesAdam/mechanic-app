<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The owner's correction of the parts margin (−50 = 50 € of it goes to someone else): zárobok only, the customer pays the same.
        Schema::table('work_orders', function (Blueprint $table) {
            $table->decimal('parts_margin_adjustment', 10, 2)->nullable()->after('total_override');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn('parts_margin_adjustment');
        });
    }
};
