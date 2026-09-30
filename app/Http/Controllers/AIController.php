<?php

namespace App\Http\Controllers;

use App\Ai\Agents\MyAssistant;
use App\Models\Message;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Ai\Responses\StreamableAgentResponse;
use Laravel\Ai\Responses\StreamedAgentResponse;

class AIController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Ai');
    }

    public function ask(Request $request): Response
    {

        $validated = $request->validate([
            'prompt' => ['required', 'string'],
            'provider' => ['required', 'string'],
        ]);

        $prompt = $validated['prompt'];
        $provider = $validated['provider'];
        Message::create([
            'content' => $prompt,
            'role' => 'user',
            'user_id' => $request->user()->id,
        ]);

        $response = (new MyAssistant)->prompt(
            $prompt,
            provider: $provider,
            model: config("ai.providers.$provider.model") ?? env(strtoupper($provider).'_AI_MODEL'),
        );
        Message::create([
            'content' => (string) $response,
            'role' => 'assistant',
            'user_id' => $request->user()->id,
        ]);

        return Inertia::render('Ai', [
            'prompt' => $prompt,
            'response' => (string) $response,
        ]);
    }

    public function example(Request $request): array
    {

        $validated = $request->validate([
            'prompt' => ['required', 'string'],
            'provider' => ['required', 'string'],
        ]);

        $prompt = $validated['prompt'];
        $provider = $validated['provider'];
        Message::create([
            'content' => $prompt,
            'role' => 'user',
            'user_id' => $request->user()->id,
        ]);

        $response = (new MyAssistant)->prompt(
            $prompt,
            provider: $provider,
            model: config("ai.providers.$provider.model") ?? env(strtoupper($provider).'_AI_MODEL'),
        );
        Message::create([
            'content' => (string) $response,
            'role' => 'assistant',
            'user_id' => $request->user()->id,
        ]);

        return [
            'prompt' => $prompt,
            'response' => (string) $response,
        ];
    }

    public function stream(Request $request): StreamableAgentResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string'],
            'provider' => ['sometimes', 'string'],
        ]);

        $prompt = $validated['prompt'];
        $provider = $validated['provider'] ?? 'faisal';
        $user = $request->user();

        return (new MyAssistant)->stream(
            $prompt,
            provider: $provider,
            model: config("ai.providers.$provider.model"),
        )->then(function (StreamedAgentResponse $response) use ($user, $prompt) {
            Message::create(['content' => $prompt, 'role' => 'user', 'user_id' => $user->id]);
            Message::create(['content' => $response->text, 'role' => 'assistant', 'user_id' => $user->id]);
        });
    }
}
