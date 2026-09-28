<?php

namespace App\Http\Controllers;

use App\Ai\Agents\MyAssistant;
use Illuminate\Http\Request;

class AIController extends Controller
{

    public function example(Request $request)
    {
        $response = (new MyAssistant)
            ->prompt($request->input('prompt'),
            provider: 'faisal',
            model: config('ai.providers.faisal.model'));

        return response()->json(['response' => $response]);
    }
}
