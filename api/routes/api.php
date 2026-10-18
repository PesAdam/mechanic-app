<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CarMakeController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DiagnosticController;
use App\Http\Controllers\Api\OperationController;
use App\Http\Controllers\Api\OrderOperationController;
use App\Http\Controllers\Api\PartController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\PublicReportController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\TimerController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VehicleLookupController;
use App\Http\Controllers\Api\WorkEntryController;
use App\Http\Controllers\Api\WorkOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::get('public/reports/{token}', [PublicReportController::class, 'show'])->middleware('throttle:60,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::patch('auth/password', [AuthController::class, 'changePassword']);

        Route::get('users', [UserController::class, 'index']);
        Route::post('users', [UserController::class, 'store']);
        Route::patch('users/{user}', [UserController::class, 'update']);

        Route::get('orders', [WorkOrderController::class, 'index']);
        Route::post('orders', [WorkOrderController::class, 'store']);
        Route::get('orders/{order}', [WorkOrderController::class, 'show']);
        Route::patch('orders/{order}', [WorkOrderController::class, 'update']);
        Route::post('orders/{order}/close', [WorkOrderController::class, 'close']);

        Route::post('orders/{order}/timer/start', [TimerController::class, 'start']);
        Route::post('orders/{order}/timer/stop', [TimerController::class, 'stop']);

        Route::post('orders/{order}/work-entries', [WorkEntryController::class, 'store']);
        Route::patch('work-entries/{entry}', [WorkEntryController::class, 'update']);
        Route::delete('work-entries/{entry}', [WorkEntryController::class, 'destroy']);

        Route::post('orders/{order}/parts', [PartController::class, 'store']);
        Route::patch('parts/{part}', [PartController::class, 'update']);
        Route::delete('parts/{part}', [PartController::class, 'destroy']);

        Route::post('orders/{order}/photos', [PhotoController::class, 'store']);
        Route::delete('photos/{photo}', [PhotoController::class, 'destroy']);

        Route::post('orders/{order}/diagnostic', [DiagnosticController::class, 'store']);
        Route::post('orders/{order}/diagnostic/codes', [DiagnosticController::class, 'storeCode']);
        Route::patch('diag-codes/{code}', [DiagnosticController::class, 'updateCode']);
        Route::delete('diag-codes/{code}', [DiagnosticController::class, 'destroyCode']);

        Route::get('operations', [OperationController::class, 'index']);
        Route::post('operations', [OperationController::class, 'store']);
        Route::patch('operations/{operation}', [OperationController::class, 'update']);
        Route::delete('operations/{operation}', [OperationController::class, 'destroy']);
        Route::post('operations/{operation}/norms', [OperationController::class, 'storeNorm']);
        Route::delete('operation-norms/{norm}', [OperationController::class, 'destroyNorm']);

        Route::get('vehicles/lookup', [VehicleLookupController::class, 'show']);
        Route::get('car-makes', [CarMakeController::class, 'index']);
        Route::post('car-makes/import-defaults', [CarMakeController::class, 'importDefaults']);
        Route::post('car-models/{model}/engines', [CarMakeController::class, 'storeEngine']);
        Route::delete('car-engines/{engine}', [CarMakeController::class, 'destroyEngine']);
        Route::post('car-makes', [CarMakeController::class, 'store']);
        Route::patch('car-makes/{make}', [CarMakeController::class, 'update']);
        Route::delete('car-makes/{make}', [CarMakeController::class, 'destroy']);
        Route::post('car-makes/{make}/models', [CarMakeController::class, 'storeModel']);
        Route::patch('car-models/{model}', [CarMakeController::class, 'updateModel']);
        Route::delete('car-models/{model}', [CarMakeController::class, 'destroyModel']);

        Route::post('orders/{order}/operations', [OrderOperationController::class, 'store']);
        Route::patch('order-operations/{orderOperation}', [OrderOperationController::class, 'update']);
        Route::delete('order-operations/{orderOperation}', [OrderOperationController::class, 'destroy']);

        Route::get('settings', [SettingController::class, 'show']);
        Route::patch('settings', [SettingController::class, 'update']);

        Route::get('dashboard', [DashboardController::class, 'show']);
    });
});
