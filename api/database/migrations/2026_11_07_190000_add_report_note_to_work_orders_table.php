<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A note to the customer about the work (what was done, what to watch); the report prints it only when it is filled in.
        Schema::table('work_orders', function (Blueprint $table) {
            $table->text('report_note')->nullable()->after('summary');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn('report_note');
        });
    }
};
