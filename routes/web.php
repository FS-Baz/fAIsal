<?php

use App\Http\Controllers\AIController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'Welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'Dashboard')->name('dashboard');
    Route::get('ai', [AIController::class, 'show'])->name('ai');
    Route::post('ai', [AIController::class, 'ask'])->name('ai.ask');
});

require __DIR__.'/settings.php';
