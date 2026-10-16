<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A hand-edited total (zľava): the billed amount and the computed one it replaced.
        Schema::table('work_orders', function (Blueprint $table) {
            $table->decimal('total_original', 10, 2)->nullable()->after('parts_pricing');
            $table->decimal('total_override', 10, 2)->nullable()->after('total_original');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn(['total_original', 'total_override']);
        });
    }
};
