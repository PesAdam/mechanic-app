<?php

use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

// The PWA lives next to the API: anything that is not /api, /storage or /up is the app.
Route::get('/{any?}', SpaController::class)->where('any', '^(?!api/|storage/|up$).*$');
