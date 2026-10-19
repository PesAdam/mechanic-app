<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A stopwatch nobody paused, closed by the system at the cap; the owner sees it flagged, the customer never does.
        Schema::table('work_entries', function (Blueprint $table) {
            $table->boolean('auto_closed')->default(false)->after('manual');
        });
    }

    public function down(): void
    {
        Schema::table('work_entries', function (Blueprint $table) {
            $table->dropColumn('auto_closed');
        });
    }
};
