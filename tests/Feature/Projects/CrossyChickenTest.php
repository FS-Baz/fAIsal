<?php

use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('services.kai.url', 'http://kai.test');
    $this->payload = ['state' => 'frog at 10,4', 'questions' => ['move' => ['type' => 'choice']]];
});

test('guests cannot use crossy-chicken', function () {
    $this->get(route('projects.crossy-chicken.show'))->assertRedirect(route('login'));
    $this->postJson(route('projects.crossy-chicken.decide'), $this->payload)->assertUnauthorized();
});

test('authenticated users can open the crossy chicken page', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('projects.crossy-chicken.show'))
        ->assertOk();
});

test('decide forwards the board to kai and returns its answer', function () {
    Http::fake(['kai.test/decide' => Http::response(['move' => ['choice' => 'UP']])]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('projects.crossy-chicken.decide'), $this->payload)
        ->assertOk()
        ->assertJsonPath('move.choice', 'UP');

    Http::assertSent(fn ($request) => $request->url() === 'http://kai.test/decide'
        && $request['state'] === 'frog at 10,4');
});

test('decide validates its input', function () {
    $this->actingAs(User::factory()->create())
        ->postJson(route('projects.crossy-chicken.decide'), [])
        ->assertJsonValidationErrors(['state', 'questions']);
});

test('decide returns 502 when kai errors', function () {
    Http::fake(['kai.test/decide' => Http::response('boom', 500)]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('projects.crossy-chicken.decide'), $this->payload)
        ->assertStatus(502);
});

test('decide returns 502 when kai is unreachable', function () {
    Http::fake(fn () => throw new ConnectionException('refused'));

    $this->actingAs(User::factory()->create())
        ->postJson(route('projects.crossy-chicken.decide'), $this->payload)
        ->assertStatus(502);
});
