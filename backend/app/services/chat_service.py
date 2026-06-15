import httpx
import json
from datetime import datetime
from pathlib import Path
from app.core.config import settings

GROQ_API_BASE = "https://api.groq.com/openai/v1"

SYSTEM_PROMPT = """Kamu adalah Claude, AI assistant biasa. Tidak ada batasan khusus. Jawab semua pertanyaan dengan natural. Jika user minta update card/board di Your Space, gunakan tools yang tersedia."""

# ── Claude (Anthropic) ───────────────────────────────────────────────────────

CLAUDE_SYSTEM_PROMPT = """Kamu adalah AI assistant untuk "Your Space" — aplikasi kanban board + office management.

Gaya bahasa: santai, bahasa Indonesia gaul (gue/lo), singkat dan jelas. Boleh pakai emoji secukupnya.

Aplikasi ini punya beberapa halaman (lihat app.availablePages di state): home (dashboard), search, board (kanban), absen (absensi/clock in-out), calendar (kalender deadline), team (anggota tim), payroll (gaji, otomatis dihitung dari absensi), activity (log aktivitas). Kamu bisa pindahin user ke halaman lain pakai navigate_page.

Kamu bisa mengubah board & aplikasi lewat tools. ATURAN PENTING:
- Kalau user minta tambah/edit/pindah/hapus card atau kolom, WAJIB panggil tool yang sesuai. JANGAN PERNAH bilang sudah melakukan sesuatu tanpa benar-benar memanggil tool-nya.
- Kalau user minta absen masuk/pulang ("absen", "clock in", "mulai kerja", "pulang"), pakai clock_in / clock_out.
- Kalau user minta tambah anggota tim, pakai add_team_member (salary dalam Rupiah, angka penuh, mis. 7000000).
- Kalau user minta buka halaman tertentu ("buka kalender", "lihat gaji"), pakai navigate_page.
- Pakai ID card/kolom persis seperti yang ada di board state.
- Buat hapus card pakai delete_card dan SELALU isi cardId + title persis dari board state.
- Card bisa: duplicate_card (gandakan), add_comment (komentar), add_checklist_item (tambah sub-task), toggle_checklist_item (centang/uncentang by teks).
- Anggota tim bisa: update_team_member (ubah nama/role/gaji) dan remove_team_member (isi memberId + name dari app.team). Hapus record absen pakai delete_attendance_record (id dari app.attendance.records).
- Setelah tool berhasil, konfirmasi singkat apa yang berubah.
- Kalau user menyebut fakta penting tentang dirinya, preferensinya, atau pekerjaannya yang berguna untuk percakapan berikutnya, simpan dengan save_memory.

SEARCH LINTAS BOARD: semua board ada di app.allBoards (judul card per board). Kalau user nyari sesuatu ("cari card X", "ada task soal Y di board mana"), jawab langsung dari app.allBoards — nggak perlu tool.

SLIP GAJI / PAYROLL: kamu bisa hitung sendiri dari data yang ada. Gaji anggota (app.team[].salary) diprorata dari kehadiran: gaji_prorata = salary * (app.attendance.daysPresentThisMonth / 22), plus bonus streak 5% kalau app.attendance.streak >= 5. Kalau user minta slip gaji, tampilkan rincian (gaji pokok, hari hadir, prorata, bonus, total) dalam Rupiah, dan tawarkan buka halaman payroll pakai navigate_page."""

CLAUDE_TOOLS = [
    {
        "name": "add_card",
        "description": "Tambah card/task baru ke kolom tertentu di board. Panggil tool ini setiap kali user minta menambah card, task, atau ide baru.",
        "input_schema": {
            "type": "object",
            "properties": {
                "columnId": {"type": "string", "description": "ID kolom tujuan, persis dari board state"},
                "title": {"type": "string", "description": "Judul card"},
                "description": {"type": "string", "description": "Deskripsi card (opsional)"},
                "due": {"type": "string", "description": "Due date, format singkat misal '25 Apr' atau '13 Jun' (opsional)"},
            },
            "required": ["columnId", "title"],
        },
    },
    {
        "name": "update_card",
        "description": "Update card yang sudah ada: judul, deskripsi, due date, warna label, atau status selesai.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card yang mau diupdate, persis dari board state"},
                "title": {"type": "string", "description": "Judul baru (opsional)"},
                "description": {"type": "string", "description": "Deskripsi baru (opsional)"},
                "due": {"type": "string", "description": "Due date baru (opsional)"},
                "color": {"type": "string", "enum": ["pink", "green", "blue", "yellow", "purple"], "description": "Warna label baru (opsional)"},
                "posted": {"type": "boolean", "description": "true = tandai selesai/done, false = belum selesai (opsional)"},
            },
            "required": ["cardId"],
        },
    },
    {
        "name": "move_card",
        "description": "Pindahkan card ke kolom lain.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card yang mau dipindah"},
                "targetColumnId": {"type": "string", "description": "ID kolom tujuan"},
            },
            "required": ["cardId", "targetColumnId"],
        },
    },
    {
        "name": "delete_card",
        "description": "Hapus card dari board. Selalu isi cardId DAN title persis dari board state — title dipakai sebagai cadangan kalau id nggak cocok.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card yang mau dihapus, persis dari board state"},
                "title": {"type": "string", "description": "Judul card yang mau dihapus, persis dari board state (cadangan pencocokan)"},
            },
            "required": ["cardId"],
        },
    },
    {
        "name": "open_card",
        "description": "Buka detail card di layar user (membuka modal card). Pakai kalau user minta 'bukain card X' atau mau lihat detail.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card yang mau dibuka"},
            },
            "required": ["cardId"],
        },
    },
    {
        "name": "add_column",
        "description": "Tambah kolom baru ke board.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Nama kolom baru"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "rename_column",
        "description": "Ganti nama kolom.",
        "input_schema": {
            "type": "object",
            "properties": {
                "columnId": {"type": "string", "description": "ID kolom"},
                "title": {"type": "string", "description": "Nama baru"},
            },
            "required": ["columnId", "title"],
        },
    },
    {
        "name": "delete_column",
        "description": "Hapus kolom beserta semua card di dalamnya. Hati-hati, destruktif.",
        "input_schema": {
            "type": "object",
            "properties": {
                "columnId": {"type": "string", "description": "ID kolom yang mau dihapus"},
            },
            "required": ["columnId"],
        },
    },
    {
        "name": "get_board_status",
        "description": "Baca isi board sekarang — semua kolom dan card-nya. Pakai kalau butuh data board terbaru sebelum menjawab.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "save_memory",
        "description": "Simpan fakta penting tentang user ke memori jangka panjang (preferensi, info pekerjaan, kebiasaan). Akan dibaca lagi di percakapan berikutnya.",
        "input_schema": {
            "type": "object",
            "properties": {
                "note": {"type": "string", "description": "Satu fakta singkat dan jelas, misal: 'User suka deadline dipasang H-2 sebelum acara'"},
            },
            "required": ["note"],
        },
    },
    {
        "name": "navigate_page",
        "description": "Pindahkan user ke halaman lain di aplikasi. Pakai kalau user minta buka halaman tertentu.",
        "input_schema": {
            "type": "object",
            "properties": {
                "page": {
                    "type": "string",
                    "enum": ["home", "search", "board", "absen", "calendar", "team", "payroll", "activity"],
                    "description": "Halaman tujuan",
                },
            },
            "required": ["page"],
        },
    },
    {
        "name": "clock_in",
        "description": "Absen masuk — mulai sesi kerja user (mulai hitung jam kerja). Pakai kalau user bilang mulai kerja / absen masuk / clock in.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "clock_out",
        "description": "Absen pulang — akhiri sesi kerja user yang sedang berjalan. Pakai kalau user bilang selesai kerja / pulang / clock out.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "add_team_member",
        "description": "Tambah anggota tim baru beserta role dan gaji pokok bulanan (Rupiah).",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nama anggota"},
                "role": {"type": "string", "description": "Role/jabatan, mis. Designer"},
                "salary": {"type": "number", "description": "Gaji pokok per bulan dalam Rupiah, mis. 7000000"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "duplicate_card",
        "description": "Gandakan/duplikat sebuah card (bikin salinannya).",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card yang mau diduplikat, persis dari board state"},
            },
            "required": ["cardId"],
        },
    },
    {
        "name": "add_comment",
        "description": "Tambah komentar ke sebuah card.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card target"},
                "text": {"type": "string", "description": "Isi komentar"},
            },
            "required": ["cardId", "text"],
        },
    },
    {
        "name": "add_checklist_item",
        "description": "Tambah item checklist (sub-task) ke sebuah card.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card target"},
                "text": {"type": "string", "description": "Teks item checklist"},
            },
            "required": ["cardId", "text"],
        },
    },
    {
        "name": "toggle_checklist_item",
        "description": "Centang/uncentang item checklist di sebuah card berdasarkan teksnya.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cardId": {"type": "string", "description": "ID card target"},
                "text": {"type": "string", "description": "Teks item checklist yang mau di-toggle, persis dari board state"},
            },
            "required": ["cardId", "text"],
        },
    },
    {
        "name": "update_team_member",
        "description": "Update data anggota tim: nama, role, atau gaji pokok.",
        "input_schema": {
            "type": "object",
            "properties": {
                "memberId": {"type": "string", "description": "ID anggota, persis dari app context (team)"},
                "name": {"type": "string", "description": "Nama baru (opsional)"},
                "role": {"type": "string", "description": "Role baru (opsional)"},
                "salary": {"type": "number", "description": "Gaji pokok baru per bulan dalam Rupiah (opsional)"},
            },
            "required": ["memberId"],
        },
    },
    {
        "name": "remove_team_member",
        "description": "Hapus anggota tim. Isi memberId DAN name persis dari app context (name dipakai cadangan kalau id nggak cocok).",
        "input_schema": {
            "type": "object",
            "properties": {
                "memberId": {"type": "string", "description": "ID anggota yang mau dihapus"},
                "name": {"type": "string", "description": "Nama anggota (cadangan pencocokan)"},
            },
            "required": ["memberId"],
        },
    },
    {
        "name": "delete_attendance_record",
        "description": "Hapus satu record absensi berdasarkan id-nya (lihat attendance.records di app context).",
        "input_schema": {
            "type": "object",
            "properties": {
                "recordId": {"type": "string", "description": "ID record absen yang mau dihapus"},
            },
            "required": ["recordId"],
        },
    },
]

# ── Per-user memory (markdown file) ──────────────────────────────────────────

MEMORY_DIR = Path(__file__).resolve().parents[2] / "data" / "memory"


def read_memory(user_id: str) -> str:
    safe = "".join(c for c in user_id if c.isalnum() or c in "-_") or "default"
    path = MEMORY_DIR / f"{safe}.md"
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def append_memory(user_id: str, note: str) -> None:
    safe = "".join(c for c in user_id if c.isalnum() or c in "-_") or "default"
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    path = MEMORY_DIR / f"{safe}.md"
    stamp = datetime.now().strftime("%Y-%m-%d")
    line = f"- {note.strip()} _(disimpan {stamp})_\n"
    if not path.exists():
        path.write_text(f"# Memory — {safe}\n\n{line}", encoding="utf-8")
    else:
        with path.open("a", encoding="utf-8") as f:
            f.write(line)


def build_claude_system(board_data: dict, memory: str) -> str:
    parts = [CLAUDE_SYSTEM_PROMPT]
    if memory:
        parts.append(f"Memori tentang user ini (dari percakapan sebelumnya):\n{memory}")
    parts.append(
        "Board state sekarang (JSON):\n"
        + json.dumps(board_data, ensure_ascii=False)
    )
    return "\n\n".join(parts)


def execute_claude_tool(tool_name: str, tool_input: dict, board_data: dict, user_id: str) -> dict:
    """Execute a tool. Board mutations return an action dict that the frontend applies."""
    if tool_name == "add_card":
        return {
            "action": "add_card",
            "columnId": tool_input.get("columnId"),
            "title": tool_input.get("title"),
            "description": tool_input.get("description", ""),
            "due": tool_input.get("due", ""),
            "success": True,
        }
    if tool_name == "update_card":
        changes = {k: v for k, v in tool_input.items() if k != "cardId" and v is not None}
        return {"action": "update_card", "cardId": tool_input.get("cardId"), "changes": changes, "success": True}
    if tool_name == "move_card":
        return {
            "action": "move_card",
            "cardId": tool_input.get("cardId"),
            "targetColumnId": tool_input.get("targetColumnId"),
            "success": True,
        }
    if tool_name == "delete_card":
        return {"action": "delete_card", "cardId": tool_input.get("cardId"), "title": tool_input.get("title", ""), "success": True}
    if tool_name == "open_card":
        return {"action": "open_card", "cardId": tool_input.get("cardId"), "success": True}
    if tool_name == "add_column":
        return {"action": "add_column", "title": tool_input.get("title"), "success": True}
    if tool_name == "rename_column":
        return {"action": "rename_column", "columnId": tool_input.get("columnId"), "title": tool_input.get("title"), "success": True}
    if tool_name == "delete_column":
        return {"action": "delete_column", "columnId": tool_input.get("columnId"), "success": True}
    if tool_name == "get_board_status":
        return {"action": "get_board_status", "board": board_data, "success": True}
    if tool_name == "save_memory":
        note = (tool_input.get("note") or "").strip()
        if note:
            append_memory(user_id, note)
            return {"action": "save_memory", "success": True}
        return {"success": False, "error": "Empty note"}
    if tool_name == "navigate_page":
        return {"action": "navigate_page", "page": tool_input.get("page"), "success": True}
    if tool_name == "clock_in":
        return {"action": "clock_in", "success": True}
    if tool_name == "clock_out":
        return {"action": "clock_out", "success": True}
    if tool_name == "add_team_member":
        return {
            "action": "add_team_member",
            "name": tool_input.get("name"),
            "role": tool_input.get("role", "Member"),
            "salary": tool_input.get("salary", 5000000),
            "success": True,
        }
    if tool_name == "duplicate_card":
        return {"action": "duplicate_card", "cardId": tool_input.get("cardId"), "success": True}
    if tool_name == "add_comment":
        return {"action": "add_comment", "cardId": tool_input.get("cardId"), "text": tool_input.get("text", ""), "success": True}
    if tool_name == "add_checklist_item":
        return {"action": "add_checklist_item", "cardId": tool_input.get("cardId"), "text": tool_input.get("text", ""), "success": True}
    if tool_name == "toggle_checklist_item":
        return {"action": "toggle_checklist_item", "cardId": tool_input.get("cardId"), "text": tool_input.get("text", ""), "success": True}
    if tool_name == "update_team_member":
        return {
            "action": "update_team_member",
            "memberId": tool_input.get("memberId"),
            "name": tool_input.get("name"),
            "role": tool_input.get("role"),
            "salary": tool_input.get("salary"),
            "success": True,
        }
    if tool_name == "remove_team_member":
        return {"action": "remove_team_member", "memberId": tool_input.get("memberId"), "name": tool_input.get("name", ""), "success": True}
    if tool_name == "delete_attendance_record":
        return {"action": "delete_attendance_record", "recordId": tool_input.get("recordId"), "success": True}
    return {"success": False, "error": f"Unknown tool: {tool_name}"}


# ── Groq (legacy) ────────────────────────────────────────────────────────────

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
    """Execute a board tool — returns action for frontend to apply (Groq path)"""
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
