import json
import time
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
from app.services.chat_service import build_messages, TOOLS, execute_tool

router = APIRouter(prefix="/api/chat", tags=["chat"])

GROQ_API_BASE      = "https://api.groq.com/openai/v1"
ANTHROPIC_API_BASE = "https://api.anthropic.com/v1"

# Claude models available
CLAUDE_MODELS = [
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-opus-4-8",
]


# ── Models endpoint ────────────────────────────────────────────────────────

@router.get("/models")
async def get_models():
    provider = settings.AI_PROVIDER

    if provider == "claude":
        return {"models": [{"provider": "Anthropic (Claude)", "models": CLAUDE_MODELS}]}

    # Groq fallback
    api_key = settings.GROQ_API_KEY
    if not api_key:
        return {"models": _groq_fallback_models()}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"{GROQ_API_BASE}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            models = [m["id"] for m in data.get("data", []) if m.get("active", True)]
            return {"models": _group_groq_models(models)}
    except Exception as e:
        return {"models": _groq_fallback_models(), "warning": str(e)}


def _group_groq_models(model_ids: list) -> list:
    groups: dict = {}
    for mid in sorted(model_ids):
        if "llama" in mid.lower():      provider = "Meta (Llama)"
        elif "gemma" in mid.lower():    provider = "Google (Gemma)"
        elif "mixtral" in mid.lower() or "mistral" in mid.lower(): provider = "Mistral"
        elif "whisper" in mid.lower():  provider = "Whisper (Audio)"
        elif "deepseek" in mid.lower(): provider = "DeepSeek"
        elif "qwen" in mid.lower():     provider = "Alibaba (Qwen)"
        else:                           provider = "Groq"
        groups.setdefault(provider, []).append(mid)
    return [{"provider": p, "models": m} for p, m in groups.items()]


def _groq_fallback_models() -> list:
    return [
        {"provider": "Meta (Llama)", "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]},
        {"provider": "Google (Gemma)", "models": ["gemma2-9b-it"]},
        {"provider": "Mistral", "models": ["mixtral-8x7b-32768"]},
    ]


# ── Stream chat ────────────────────────────────────────────────────────────

class StreamChatRequest(BaseModel):
    message: str
    model: str = "claude-3-5-haiku-20241022"
    chat_history: List[dict] = []
    board_data: dict = {}
    system_prompt: Optional[str] = None


@router.post("/stream")
async def stream_chat(request: StreamChatRequest):
    provider = settings.AI_PROVIDER

    if provider == "claude":
        return await _stream_claude(request)
    else:
        return await _stream_groq(request)


# ── Claude streaming ───────────────────────────────────────────────────────

async def _stream_claude(request: StreamChatRequest):
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key or api_key == "your_claude_api_key_here":
        raise HTTPException(400, "ANTHROPIC_API_KEY belum diset di backend .env")

    messages = build_messages(
        request.message,
        request.chat_history,
        request.board_data,
        request.system_prompt,
    )

    # Separate system message from user/assistant messages
    system_msg = ""
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system_msg = m["content"]
        else:
            chat_messages.append({"role": m["role"], "content": m["content"]})

    async def event_generator():
        start = time.time()
        full_text = ""
        input_tokens = 0
        output_tokens = 0

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    f"{ANTHROPIC_API_BASE}/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": request.model,
                        "max_tokens": 2048,
                        "system": system_msg,
                        "messages": chat_messages,
                        "stream": True,
                    },
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        yield f"data: {json.dumps({'type': 'error', 'error': f'Claude API error {resp.status_code}: {body.decode()[:200]}'})}\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if not raw:
                            continue
                        try:
                            event = json.loads(raw)
                            etype = event.get("type", "")

                            if etype == "content_block_delta":
                                token = event.get("delta", {}).get("text", "")
                                if token:
                                    full_text += token
                                    output_tokens += 1
                                    yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

                            elif etype == "message_start":
                                usage = event.get("message", {}).get("usage", {})
                                input_tokens = usage.get("input_tokens", 0)

                            elif etype == "message_delta":
                                usage = event.get("usage", {})
                                output_tokens = usage.get("output_tokens", output_tokens)

                        except Exception:
                            continue

            elapsed = round(time.time() - start, 2)
            yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'input_tokens': input_tokens, 'output_tokens': output_tokens, 'elapsed': elapsed, 'tool_actions': []})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Groq streaming (fallback) ──────────────────────────────────────────────

async def _stream_groq(request: StreamChatRequest):
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise HTTPException(400, "GROQ_API_KEY not set in backend .env")

    messages = build_messages(
        request.message,
        request.chat_history,
        request.board_data,
        request.system_prompt,
    )

    async def event_generator():
        start = time.time()
        full_text = ""
        input_tokens = 0
        output_tokens = 0
        tool_actions = []

        try:
            loop_messages = messages.copy()

            for _ in range(5):
                async with httpx.AsyncClient(timeout=30) as client:
                    probe = await client.post(
                        f"{GROQ_API_BASE}/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={"model": request.model, "messages": loop_messages, "tools": TOOLS, "tool_choice": "auto", "max_tokens": 1024},
                    )
                    probe.raise_for_status()
                    probe_data = probe.json()

                choice = probe_data["choices"][0]
                usage = probe_data.get("usage", {})
                input_tokens = usage.get("prompt_tokens", 0)

                if choice["message"].get("tool_calls"):
                    tool_calls = choice["message"]["tool_calls"]
                    loop_messages.append({"role": "assistant", "content": choice["message"].get("content") or "", "tool_calls": tool_calls})
                    for tc in tool_calls:
                        fn_name = tc["function"]["name"]
                        fn_args = json.loads(tc["function"]["arguments"])
                        result = await execute_tool(fn_name, fn_args, request.board_data)
                        tool_actions.append({"tool": fn_name, "args": fn_args, "result": result})
                        yield f"data: {json.dumps({'type': 'tool', 'tool': fn_name, 'args': fn_args, 'result': result})}\n\n"
                        loop_messages.append({"role": "tool", "tool_call_id": tc["id"], "content": json.dumps(result)})
                else:
                    break

            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST", f"{GROQ_API_BASE}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": request.model, "messages": loop_messages, "stream": True, "max_tokens": 2048},
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if raw == "[DONE]":
                            break
                        try:
                            chunk = json.loads(raw)
                            token = chunk["choices"][0]["delta"].get("content", "")
                            if token:
                                full_text += token
                                output_tokens += 1
                                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
                        except Exception:
                            continue

            elapsed = round(time.time() - start, 2)
            yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'input_tokens': input_tokens, 'output_tokens': output_tokens, 'elapsed': elapsed, 'tool_actions': tool_actions})}\n\n"

        except httpx.HTTPStatusError as e:
            yield f"data: {json.dumps({'type': 'error', 'error': f'Groq API error {e.response.status_code}'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
