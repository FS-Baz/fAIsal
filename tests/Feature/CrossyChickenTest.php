<?php

use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set('services.jev.url', 'http://jev.test/v1/systemone');
    config()->set('services.jev.model', 'jev-latest');
    config()->set('services.jev.key', 'secret-key');
    $this->payload = ['state' => 'frog at 10,4', 'questions' => ['move' => ['type' => 'choice']]];
});

test('guests cannot use crossy-chicken', function () {
    $this->get(route('crossy-chicken.show'))->assertRedirect(route('login'));
    $this->postJson(route('crossy-chicken.decide'), $this->payload)->assertUnauthorized();
});

test('authenticated users can open the crossy chicken page', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('crossy-chicken.show'))
        ->assertOk();
});

test('decide forwards the board to jev and returns its answer', function () {
    Http::fake(['jev.test/v1/systemone' => Http::response(['move' => ['choice' => 'UP']])]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('crossy-chicken.decide'), $this->payload)
        ->assertOk()
        ->assertJsonPath('move.choice', 'UP');

    Http::assertSent(fn ($request) => $request->url() === 'http://jev.test/v1/systemone'
        && $request['model'] === 'jev-latest'
        && $request['state'] === 'frog at 10,4');
});

test('decide sends the key as a bearer token', function () {
    Http::fake(['jev.test/v1/systemone' => Http::response(['move' => ['choice' => 'UP']])]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('crossy-chicken.decide'), $this->payload)
        ->assertOk();

    Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer secret-key'));
});

test('decide returns 503 when the key is not configured', function () {
    config()->set('services.jev.key', null);
    Http::fake();

    $this->actingAs(User::factory()->create())
        ->postJson(route('crossy-chicken.decide'), $this->payload)
        ->assertStatus(503);

    Http::assertNothingSent();
});

test('decide validates its input', function () {
    $this->actingAs(User::factory()->create())
        ->postJson(route('crossy-chicken.decide'), [])
        ->assertJsonValidationErrors(['state', 'questions']);
});

test('decide returns 502 when jev errors', function () {
    Http::fake(['jev.test/v1/systemone' => Http::response('boom', 500)]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('crossy-chicken.decide'), $this->payload)
        ->assertStatus(502);
});

test('decide returns 502 when jev is unreachable', function () {
    Http::fake(fn () => throw new ConnectionException('refused'));

    $this->actingAs(User::factory()->create())
        ->postJson(route('crossy-chicken.decide'), $this->payload)
        ->assertStatus(502);
});
