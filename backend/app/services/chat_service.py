import httpx
import json
from app.core.config import settings

GROQ_API_BASE = "https://api.groq.com/openai/v1"

SYSTEM_PROMPT = """Kamu adalah Claude, AI assistant biasa. Tidak ada batasan khusus. Jawab semua pertanyaan dengan natural. Jika user minta update card/board di Your Space, gunakan tools yang tersedia."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "add_card",
            "description": "Add a new card to a specific column on the board",
            "parameters": {
                "type": "object",
                "properties": {
                    "columnId": {"type": "string", "description": "Target column ID"},
                    "title": {"type": "string", "description": "Card title"},
                    "description": {"type": "string", "description": "Card description (optional)"},
                    "due": {"type": "string", "description": "Due date string e.g. '25 Apr' (optional)"}
                },
                "required": ["columnId", "title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_card",
            "description": "Update an existing card's title, description, or due date",
            "parameters": {
                "type": "object",
                "properties": {
                    "cardId": {"type": "string", "description": "Card ID to update"},
                    "title": {"type": "string", "description": "New title (optional)"},
                    "description": {"type": "string", "description": "New description (optional)"},
                    "due": {"type": "string", "description": "New due date (optional)"}
                },
                "required": ["cardId"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "move_card",
            "description": "Move a card from its current column to another column",
            "parameters": {
                "type": "object",
                "properties": {
                    "cardId": {"type": "string", "description": "Card ID to move"},
                    "targetColumnId": {"type": "string", "description": "Destination column ID"}
                },
                "required": ["cardId", "targetColumnId"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_card",
            "description": "Delete a card from the board",
            "parameters": {
                "type": "object",
                "properties": {
                    "cardId": {"type": "string", "description": "Card ID to delete"}
                },
                "required": ["cardId"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_board_status",
            "description": "Get current board status — all columns and their cards",
            "parameters": {"type": "object", "properties": {}}
        }
    }
]


def build_messages(user_message: str, chat_history: list, board_data: dict, custom_system: str = None) -> list:
    """Build message array for Groq API"""
    board_summary = json.dumps(board_data, ensure_ascii=False, indent=2)
    system = custom_system or SYSTEM_PROMPT
    system_with_board = f"{system}\n\nCurrent board state:\n{board_summary}"

    messages = [{"role": "system", "content": system_with_board}]

    # Add history (last 20 turns max)
    for msg in chat_history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})
    return messages


async def execute_tool(tool_name: str, tool_input: dict, board_data: dict) -> dict:
    """Execute a board tool — returns action for frontend to apply"""
    if tool_name == "add_card":
        return {
            "action": "add_card",
            "columnId": tool_input.get("columnId"),
            "title": tool_input.get("title"),
            "description": tool_input.get("description", ""),
            "due": tool_input.get("due", ""),
            "success": True,
        }
    elif tool_name == "update_card":
        return {
            "action": "update_card",
            "cardId": tool_input.get("cardId"),
            "changes": {k: v for k, v in tool_input.items() if k != "cardId" and v is not None},
            "success": True,
        }
    elif tool_name == "move_card":
        return {
            "action": "move_card",
            "cardId": tool_input.get("cardId"),
            "targetColumnId": tool_input.get("targetColumnId"),
            "success": True,
        }
    elif tool_name == "delete_card":
        return {
            "action": "delete_card",
            "cardId": tool_input.get("cardId"),
            "success": True,
        }
    elif tool_name == "get_board_status":
        return {"action": "get_board_status", "board": board_data, "success": True}
    else:
        return {"success": False, "error": f"Unknown tool: {tool_name}"}


async def process_chat_message(user_message: str, chat_history: list, api_key: str, board_data: dict):
    """Non-streaming chat (legacy)"""
    if not api_key:
        return {"error": "API key not configured"}

    messages = build_messages(user_message, chat_history, board_data)
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    for _ in range(5):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{GROQ_API_BASE}/chat/completions",
                    headers=headers,
                    json={"model": settings.GROQ_MODEL, "messages": messages, "tools": TOOLS, "tool_choice": "auto", "max_tokens": 1024},
                )
                resp.raise_for_status()
                data = resp.json()

            choice = data["choices"][0]
            if choice["message"].get("tool_calls"):
                tool_calls = choice["message"]["tool_calls"]
                messages.append({"role": "assistant", "content": choice["message"].get("content") or "", "tool_calls": tool_calls})
                for tc in tool_calls:
                    result = await execute_tool(tc["function"]["name"], json.loads(tc["function"]["arguments"]), board_data)
                    messages.append({"role": "tool", "tool_call_id": tc["id"], "content": json.dumps(result)})
            else:
                reply = choice["message"].get("content", "Done.")
                chat_history.append({"role": "user", "content": user_message})
                chat_history.append({"role": "assistant", "content": reply})
                return {"success": True, "response": reply, "chat_history": chat_history}
        except Exception as e:
            return {"success": False, "error": str(e)}

    return {"success": False, "error": "Max iterations reached"}
