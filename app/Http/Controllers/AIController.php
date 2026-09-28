<?php

namespace App\Http\Controllers;

use App\Ai\Agents\MyAssistant;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AIController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Ai');
    }

    public function ask(Request $request): Response
    {
        $prompt = $request->validate(['prompt' => ['required', 'string']])['prompt'];

        $response = (new MyAssistant)->prompt(
            $prompt,
            provider: 'faisal',
            model: config('ai.providers.faisal.model'),
        );

        return Inertia::render('Ai', [
            'prompt' => $prompt,
            'response' => (string) $response,
        ]);
    }
}
