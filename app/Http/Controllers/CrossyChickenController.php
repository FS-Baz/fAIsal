<?php

namespace App\Http\Controllers;

use App\Http\Requests\DecideMoveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CrossyChickenController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('CrossyChicken');
    }

    /**
     * Forward the board state to the Kai decision model and return its answer.
     */
    public function decide(DecideMoveRequest $request): JsonResponse
    {
        try {
            $response = Http::timeout(config('services.kai.timeout'))
                ->acceptJson()
                ->post(rtrim(config('services.kai.url'), '/').'/decide', $request->validated());
        } catch (Throwable $e) {
            Log::error('Kai unreachable', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'Kai unreachable'], 502);
        }

        if (! $response->successful()) {
            Log::error('Kai error', ['status' => $response->status(), 'body' => substr($response->body(), 0, 500)]);

            return response()->json(['error' => 'Kai error', 'status' => $response->status()], 502);
        }

        return response()->json($response->json());
    }
}
