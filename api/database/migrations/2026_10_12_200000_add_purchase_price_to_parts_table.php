<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // `price` is the retail price (MOC) printed on the invoice;
        // `purchase_price` is what the workshop paid (NC), used for margins.
        Schema::table('parts', function (Blueprint $table) {
            $table->decimal('purchase_price', 10, 2)->nullable()->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('parts', function (Blueprint $table) {
            $table->dropColumn('purchase_price');
        });
    }
};
