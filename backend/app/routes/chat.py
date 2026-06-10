import json
import time
import httpx
from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
from app.services.chat_service import (
    build_messages, TOOLS, execute_tool,
    CLAUDE_TOOLS, build_claude_system, execute_claude_tool, read_memory,
)

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
    model: str = "claude-haiku-4-5"
    chat_history: List[dict] = []
    board_data: dict = {}
    system_prompt: Optional[str] = None
    user_id: str = "anesh"


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

    board_data = request.board_data or {}
    user_id = request.user_id or "default"
    memory = read_memory(user_id)
    system_msg = request.system_prompt or build_claude_system(board_data, memory)

    chat_messages = []
    for m in request.chat_history[-20:]:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            chat_messages.append({"role": role, "content": content})
    chat_messages.append({"role": "user", "content": request.message})

    async def event_generator():
        start = time.time()
        full_text = ""
        input_tokens = 0
        output_tokens = 0
        tool_actions = []
        messages = chat_messages

        client = AsyncAnthropic(api_key=api_key)
        try:
            # Agentic loop: stream → execute tools → feed results back → repeat
            for _ in range(6):
                async with client.messages.stream(
                    model=request.model,
                    max_tokens=4096,
                    system=system_msg,
                    messages=messages,
                    tools=CLAUDE_TOOLS,
                ) as stream:
                    async for event in stream:
                        if (
                            event.type == "content_block_delta"
                            and event.delta.type == "text_delta"
                            and event.delta.text
                        ):
                            full_text += event.delta.text
                            yield f"data: {json.dumps({'type': 'token', 'token': event.delta.text})}\n\n"
                    final = await stream.get_final_message()

                input_tokens += final.usage.input_tokens
                output_tokens += final.usage.output_tokens

                if final.stop_reason != "tool_use":
                    break

                # Execute every tool_use block, send results back
                messages = messages + [{"role": "assistant", "content": final.content}]
                tool_results = []
                for block in final.content:
                    if block.type != "tool_use":
                        continue
                    tool_input = block.input or {}
                    result = execute_claude_tool(block.name, tool_input, board_data, user_id)
                    tool_actions.append({"tool": block.name, "args": tool_input, "result": result})
                    yield f"data: {json.dumps({'type': 'tool', 'tool': block.name, 'args': tool_input, 'result': result})}\n\n"
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    })
                messages = messages + [{"role": "user", "content": tool_results}]
                if full_text:
                    full_text += "\n\n"

            elapsed = round(time.time() - start, 2)
            yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'input_tokens': input_tokens, 'output_tokens': output_tokens, 'elapsed': elapsed, 'tool_actions': tool_actions})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        finally:
            await client.close()

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
