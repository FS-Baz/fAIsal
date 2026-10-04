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
     * Forward the board state to the hosted JEV decision API and return its answer.
     */
    public function decide(DecideMoveRequest $request): JsonResponse
    {
        $url = config('services.jev.url');
        $key = config('services.jev.key');

        if (blank($url) || blank($key)) {
            Log::error('JEV is not configured: set JEV_API_URL and JEV_API_KEY');

            return response()->json(['error' => 'JEV is not configured'], 503);
        }

        try {
            $response = Http::withToken($key)
                ->timeout(config('services.jev.timeout'))
                ->acceptJson()
                ->post(rtrim($url, '/').'/decide', $request->validated());
        } catch (Throwable $e) {
            Log::error('JEV unreachable', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'JEV unreachable'], 502);
        }

        if (! $response->successful()) {
            Log::error('JEV error', ['status' => $response->status(), 'body' => substr($response->body(), 0, 500)]);

            return response()->json(['error' => 'JEV error', 'status' => $response->status()], 502);
        }

        return response()->json($response->json());
    }
}
