<?php

use App\Http\Controllers\AIController;
use App\Http\Controllers\CrossyChickenController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'Welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'Dashboard')->name('dashboard');
    Route::get('ai', [AIController::class, 'show'])->name('ai');
    Route::post('ai', [AIController::class, 'ask'])->name('ai.ask');
    Route::post('ai/respond', [AIController::class, 'example'])->name('ai.respond');
    Route::get('crossy-chicken', [CrossyChickenController::class, 'show'])->name('crossy-chicken.show');
    Route::post('crossy-chicken/decide', [CrossyChickenController::class, 'decide'])
        ->middleware('throttle:60,1')
        ->name('crossy-chicken.decide');
});

require __DIR__.'/settings.php';
