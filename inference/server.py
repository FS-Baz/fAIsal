"""Kai decision service.

Loads the Decision-2.0-Kai-0.6B model once and exposes it over HTTP for the
Laravel app. Bind it to localhost only: Laravel is the sole client.
"""

import os
import time

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoModel

MODEL = os.environ.get("KAI_MODEL", "vllm-sr/Decision-2.0-Kai-0.6B")
# trust_remote_code executes code from the model repo, so pin it to a reviewed commit.
REVISION = os.environ.get("KAI_REVISION", "cd49ea3813fd8ba0928a9a23ef6c9a0f2f0cd764")
HOST = os.environ.get("KAI_HOST", "127.0.0.1")
PORT = int(os.environ.get("KAI_PORT", "8001"))

print("Loading Decision model...")
model = AutoModel.from_pretrained(MODEL, revision=REVISION, trust_remote_code=True)
print("Decision model loaded!")

app = FastAPI(title="Kai Decision API", version="1.0")


class DecisionRequest(BaseModel):
    state: str
    questions: dict


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "revision": REVISION}


@app.post("/decide")
def decide(request: DecisionRequest):
    start = time.perf_counter()

    result = model.system_one(state=request.state, questions=request.questions)

    elapsed = time.perf_counter() - start

    # result["answers"] looks like: { "move": { "choice": "UP", ... } }
    answers = result.get("answers", result)

    return {
        **answers,
        "_meta": {"model": MODEL, "elapsed_ms": round(elapsed * 1000, 1)},
    }


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
