# YOUR SPACE — Handoff Doc & Roadmap

> **Dokumen serah-terima.** Baca ini dari atas ke bawah dan lo bisa nerusin project ini tanpa konteks lain.
> Produk: kanban board + office management (absen, tim, payroll) + AI assistant (Claude API).
> Target akhir: **live di internet** — orang bisa daftar, login, pakai semua fitur, dan share board untuk kolaborasi.
> Untuk AI lain: dokumen ini adalah satu-satunya handoff utama. Ikuti AI operating brief di bawah sebelum edit apa pun.

Terakhir update: **12 Juni 2026** · Progress: **~73%** · Fase 1 (fondasi auth + server data) ✅ SELESAI & terverifikasi E2E

---

## AI OPERATING BRIEF (WAJIB DIIKUTI)

Tujuan utama project: bikin Your Space live untuk karyawan dan pemakaian pribadi. Owner maunya workflow simpel: tinggal push ke GitHub branch `main`, lalu deploy otomatis jalan di `deploy.artnesh.cloud`.

### Act as

Act as:

- Product Manager
- UX Designer
- Senior Frontend Engineer
- Senior Backend Engineer
- pro user
- founder/owner
- bawahan gue yg setia, dan selalu cari cara untuk menyenangkan saya

Cara menjalankan role:

- **Product Manager**: jaga prioritas, scope, progress, definisi selesai, dan urutan kerja menuju live.
- **UX Designer**: jaga flow, rasa UI, empty state, loading, error, mobile, dan kenyamanan karyawan sebagai user harian.
- **Senior Frontend Engineer**: jaga React/Vite, state, API integration, build, performance, responsive, dan UI consistency.
- **Senior Backend Engineer**: jaga FastAPI, auth, database, upload, security, env, deploy, healthcheck, dan data durability.
- **Pro user**: cari shortcut, automation, bulk action, export, speed, dan fitur yang bikin app enak dipakai tiap hari.
- **Founder/owner**: pikirkan biaya, reliability, data ownership, backup, onboarding karyawan, dan risiko bisnis.
- **Bawahan setia**: proaktif, rapi, jujur soal risiko, tidak banyak alasan, dan selalu cari cara paling masuk akal untuk menyenangkan owner tanpa merusak kualitas.

### Format wajib setiap balasan

Setiap kirim pesan ke owner, kasih tahu:

1. Progress perjalanan saat ini dalam persen.
2. Apa yang baru selesai.
3. Tinggal apa lagi yang harus dikerjakan.
4. Checklist kerja berikutnya.
5. Risiko/blocker kalau ada.
6. Saran langkah paling cepat menuju live.

Contoh format pendek:

```text
Progress: 73%
Baru selesai: auth lokal, state server, docs, folder boundary.
Tinggal: rotate API key, deploy backend, deploy frontend, test production, aktifkan auto-deploy.
Checklist:
- [ ] Rotate Anthropic key
- [ ] Set env production
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Smoke test daftar/login/CRUD/reload/AI
Risiko: upload lokal hilang kalau container redeploy tanpa volume/storage.
Langkah cepat: beresin env + deploy backend dulu.
```

Jangan asal menaikkan progress. Progress naik hanya kalau ada bukti: build/test/deploy/smoke test/checklist benar-benar selesai.

### Target live

Definition of done untuk live:

- [ ] Owner push ke GitHub branch `main`.
- [ ] `deploy.artnesh.cloud` otomatis pull/build/deploy.
- [ ] Backend healthcheck pass.
- [ ] Frontend bisa diakses publik.
- [ ] User bisa daftar akun.
- [ ] User bisa login.
- [ ] User bisa bikin/edit/move/delete card.
- [ ] Data tetap ada setelah refresh dan login ulang.
- [ ] AI chat jalan tanpa API key bocor ke frontend.
- [ ] Minimal 1 karyawan lain bisa dipakaiin akun atau share board.

### Checklist menuju live

#### P0 - Security & Env

- [ ] Rotate `ANTHROPIC_API_KEY`.
- [ ] Pastikan `.env` tidak ikut Git.
- [ ] Set `SECRET_KEY` production, jangan auto-generated.
- [ ] Set `DATABASE_URL` production.
- [ ] Set `FRONTEND_ORIGINS` production.
- [ ] Set `VITE_API_BASE_URL` ke URL backend production.

#### P0 - Backend Production

- [ ] Deploy backend via Dockerfile.
- [ ] Healthcheck `/health` return 200.
- [ ] Database production tersambung.
- [ ] Auth register/login/me jalan di production.
- [ ] State API jalan di production.
- [ ] Upload punya volume persistent atau pindah ke object storage.

#### P0 - Frontend Production

- [ ] Build Vite sukses.
- [ ] Frontend deploy dengan env production.
- [ ] Login page tampil.
- [ ] API call tidak 502/404/CORS error.
- [ ] Refresh tidak logout kalau token masih valid.

#### P0 - Auto Deploy

- [ ] GitHub repo `artnesh06/yourspace` terhubung ke Coolify/deploy.artnesh.cloud.
- [ ] Branch deploy = `main`.
- [ ] Push commit kecil memicu deployment otomatis.
- [ ] Jika build gagal, log mudah ditemukan.
- [ ] Jika deploy sukses, status container healthy.

#### P1 - Karyawan & Pemakaian Pribadi

- [ ] Seed/default workspace untuk user baru.
- [ ] Role dasar: owner/admin/member.
- [ ] Share board atau invite karyawan.
- [ ] Komentar card memakai nama user asli.
- [ ] Activity log per user.
- [ ] Backup database.

#### P1 - UX Live-Ready

- [ ] Loading state saat data server dimuat.
- [ ] Error state yang ramah, bukan cuma `HTTP 502`.
- [ ] Empty state untuk user baru.
- [ ] Toast "tersimpan".
- [ ] Mobile layout minimal usable.
- [ ] Konfirmasi custom untuk delete.

#### P2 - Power User

- [ ] Keyboard shortcuts.
- [ ] Undo delete.
- [ ] Bulk move cards.
- [ ] Export CSV/JSON.
- [ ] Template board.
- [ ] Deadline notification.

### Do

- Selalu baca dokumen ini sebelum ambil keputusan besar.
- Selalu cek file lokal dulu sebelum edit.
- Selalu jaga pemisahan `YOUR SPACE` sebagai app dan `deploy.artnesh` sebagai infra/deploy.
- Selalu cek build sebelum bilang siap push/deploy.
- Selalu jelaskan progress persen dan checklist berikutnya.
- Selalu prioritaskan live path daripada polish berlebihan.
- Selalu pakai bahasa Indonesia santai yang jelas buat owner.
- Selalu berani bilang kalau ada blocker.
- Selalu jaga API key dan secrets.
- Selalu pikirkan karyawan sebagai user harian, bukan cuma demo.

### Don'ts

- Jangan commit `.env`, `.secret`, database lokal, upload user, `node_modules`, `dist`, atau `venv`.
- Jangan campur dokumen infra ke repo app kalau itu milik `deploy.artnesh`.
- Jangan bikin fitur besar baru sebelum P0 live selesai.
- Jangan mengubah struktur data besar tanpa migrasi/backup plan.
- Jangan menghapus file user/backup lokal tanpa izin.
- Jangan bilang "sudah deploy" sebelum healthcheck dan smoke test jelas.
- Jangan naikkan progress persen cuma karena commit berhasil.
- Jangan expose API key di frontend, screenshot, atau markdown.
- Jangan pakai dependency baru kalau solusi sederhana cukup.
- Jangan membuat UI terlalu teknis untuk karyawan.

### Folder boundary

```text
YOUR SPACE/
  frontend/          -> React/Vite app
  backend/           -> FastAPI backend
  backend/data/      -> runtime lokal, ignored
  yourspace.md       -> AI handoff + product + technical roadmap app
  DEPLOYMENT.md      -> cara deploy app

deploy.artnesh/
  coolify/           -> platform deploy/rebrand
  docs/              -> VPS, DNS, Supabase, Coolify, roadmap infra
```

### How to think

Prioritas tertinggi adalah membuat app stabil dan live:

1. Amankan secrets.
2. Pastikan backend production sehat.
3. Pastikan frontend production connect ke backend.
4. Pastikan push GitHub memicu deploy otomatis.
5. Pastikan flow owner dan karyawan jalan.
6. Baru polish dan tambah fitur.

Kalau bingung, pilih langkah yang paling dekat ke "owner push GitHub -> auto deploy -> app bisa dipakai karyawan".

---

## 0. CARA JALANIN LOKAL (mulai dari sini)

```bash
# Backend (FastAPI, port 8000) — WAJIB pakai venv/bin/python (BUKAN source activate, lihat Gotcha #1)
cd backend && venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (Vite React, port 5173)
cd frontend && npm run dev

# Atau sekali jalan:
./start-local.sh
```

- Buka `http://localhost:5173` → halaman **login/daftar** muncul. Daftar akun baru → masuk workspace.
- Vite dev **proxy** meneruskan `/api/*` & `/uploads/*` ke `127.0.0.1:8000` (lihat `frontend/vite.config.js`).
- Test user yang sudah ada di DB lokal: `anesh@test.com` / `rahasia123`.
- Env backend: `backend/.env` → `ANTHROPIC_API_KEY` (untuk AI chat), `AI_PROVIDER=claude`, `DATABASE_URL` (default SQLite `yourspace.db`).

---

## 1. ARSITEKTUR & PETA FILE

```
[React/Vite :5173] ──proxy /api──> [FastAPI :8000] ──> [SQLite lokal / PostgreSQL prod]
        │                              ├──> [Claude API — key di server]
        │                              └──> [backend/data/uploads/ — file user]
```

### Backend (`backend/`)
| File | Isi |
|---|---|
| `main.py` | FastAPI app, CORS, mount router + static `/uploads` |
| `app/core/config.py` | Settings dari env (.env) |
| `app/core/database.py` | Engine SQLAlchemy (sync). **Normalisasi URL**: strip `+aiosqlite`/`+asyncpg`, `postgres://`→`postgresql://`. DDL portable SQLite/PG: tabel `users`, `user_state`, `board_shares` (disiapkan buat Fase 3), `board` (legacy) |
| `app/core/security.py` | **Zero-dependency auth**: PBKDF2 (stdlib) password hash + token HMAC-signed (mirip JWT). Secret: env `SECRET_KEY` atau auto-generate ke `backend/data/.secret`. Dependency `get_current_user` |
| `app/routes/auth.py` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| `app/routes/state.py` | **KV per-user**: `GET/PUT /api/state/{key}`, key ∈ {boards, attendance, team, activity, chat}. Data = JSON blob per key. Max 4MB |
| `app/routes/upload.py` | `POST /api/upload` (multipart, max 15MB, ekstensi whitelist) → simpan `backend/data/uploads/`, return `{url:"/uploads/xxx"}` |
| `app/routes/chat.py` | `POST /api/chat/stream` (SSE streaming Claude + agentic tool loop), `GET /api/chat/models`. ⚠️ masih ada path Groq legacy (mati, ~300 baris, boleh dihapus) |
| `app/services/chat_service.py` | System prompt (bahasa gaul ID), **14 CLAUDE_TOOLS** (add/update/move/delete card, kolom CRUD, open_card, get_board_status, save_memory, navigate_page, clock_in/out, add_team_member), executor → return action dict ke frontend. Memory per-user di `backend/data/memory/{user}.md` |
| `Dockerfile` | Siap deploy (Coolify/Railway) |

### Frontend (`frontend/src/`)
| File | Isi |
|---|---|
| `main.jsx` | Root + **ErrorBoundary** (crash → tampil error + tombol reload, bukan layar putih) |
| `App.jsx` | `App` = auth gate (checking → splash; !user → AuthPage; user → `Workspace key={user.id}`). `Workspace` = seluruh app: sidebar 7 page + theme toggle + avatar logout, topbar, routing page via state, DnD board, chat panel, CardModal, AI tool handler (`handleToolCall`), AI reminder deadline saat chat dibuka, deep-link `#card=ID` |
| `lib/api.js` | `apiUrl`, `getToken/setToken` (localStorage `ys-token`), `apiFetch` (Bearer + throw on !ok), `uploadFile` (multipart) |
| `lib/due.js` | Status deadline: `done/late/today/soon/scheduled/none` → warna `green/red/yellow/blue/cream`. Parse legacy "15 Apr" + `dueAt` ISO. `fmtDueRange`, `stripHtml` |
| `lib/dominantColor.js` | Warna dominan gambar via canvas (cached) — dipakai cover card & banner modal |
| `hooks/useAuth.js` | login/register/logout + `GET /me` validasi token saat load |
| `hooks/useServerState.js` | **Jantung persistence**: load `GET /api/state/{key}` → kalau server null & ada localStorage lama (legacyKey) → **auto-migrate** push ke server. Save debounced 800ms `PUT`. ⚠️ Lihat Gotcha #2 |
| `hooks/useBoard.js` | `useMultiBoard` di atas useServerState('boards'). **Normalisasi data server** (board tanpa columns/cards nggak boleh crash). API: boards, activeId, addTab/switchTab/deleteTab, addCard/updateCard/deleteCard/moveCard/duplicateCard, addColumn/renameColumn/deleteColumn, addComment/deleteComment, getBoardSummary |
| `hooks/useAttendance.js` | clock in/out, records, monthMs, daysPresent, streak (server state 'attendance') |
| `hooks/useTeam.js` | members CRUD + `fmtIDR` (server state 'team') |
| `hooks/useActivity.js` | log feed, max 300 (server state 'activity') |
| `hooks/useChat.js` | SSE streaming ke `/api/chat/stream`, tool events → `onToolCall`, `addLocalAssistant` (buat reminder), history di localStorage `ys-chat-v1` |
| `hooks/useTheme.js` | `light/system/dark` → `<html data-theme>`, persist `ys-theme` |
| `pages/AuthPage.jsx` | Login/Daftar, tab switch, serif title + starburst |
| `pages/HomePage.jsx` | Greeting dinamis + jam live, stat NumberFlow, **heatmap GitHub-style** (aktivitas+absen, today centered), bar chart 7 hari, breakdown kolom, deadline, quick actions, activity feed |
| `pages/SearchPage.jsx` | Kloning Claude.ai (centered, serif). Ketik = cari lintas board (highlight), **Enter = tanya AI** (`onAskAI`) |
| `pages/ClockPage.jsx` | Timer live + jam analog SVG + **confetti saat clock in** + riwayat |
| `pages/CalendarPage.jsx` | Grid bulan, due date semua board, klik tanggal → task |
| `pages/TeamPage.jsx` / `PayrollPage.jsx` | Tim CRUD; gaji prorata dari absen (22 hari) + bonus streak 5%, slip gaji modal |
| `components/CardModal.jsx` | Pop-up card ala Trello: cover banner (warna dominan, klik → lightbox), rich description contentEditable (paste dari Docs format kebawa) + collapse Show more, DatePicker horizontal (start+due+jam), checklist + progress, multi-attachment (upload via API, fallback base64), lightbox fullscreen, panel resizable (drag divider, persist `ys-modal-split`), copy link `#card=ID`, comments + edit |
| `components/KanbanCard.jsx` | Cover **fit + bg warna dominan**, label strip warna, chip status deadline, chip checklist "2/5" |
| `components/NumberFlow-standalone.jsx` | Rolling digits (odometer) — dipakai semua stat |
| `components/ErrorBoundary.jsx` | Error screen ramah |
| `App.css` | ~3.500 baris. Tema: cream `#FAF9F5` / ink / oranye Claude `#C96442`. Blok dark theme `html[data-theme="dark"]` di bagian bawah. ⚠️ ada duplikasi selector (override cascade sengaja) — konsolidasi masuk Fase 4 |
| `index.css` | Design tokens (`:root` + dark) , font Inter + `--font-serif` |

### Model data card (penting!)
```js
card = { id, title, description /* HTML string */, due /* legacy "15 Apr" */, dueAt /* ISO */, startAt,
         posted /* done */, color /* label */, checklist: [{id,text,done}],
         images: [{id,name,url,uploadedAt}], coverId, files: [{id,name,url,size,type}], comments: [...] }
```
`due` (string pendek) **selalu di-sync** saat set `dueAt` — kalender & home masih parse string itu.

---

## 2. YANG SUDAH JADI (semua terverifikasi)

- ✅ **7 halaman**: Home (dashboard+heatmap+chart), Search (=AI chat), Board kanban multi-board, Absensi, Kalender, Tim, Payroll
- ✅ **Auth penuh**: daftar → login → token 30 hari → logout. Data per-akun
- ✅ **Semua data di server** (SQLite lokal / PG prod) — boards, absen, tim, activity. Auto-migrate dari localStorage lama
- ✅ **AI assistant**: streaming, 14 tools (termasuk navigasi page, clock in/out, tambah anggota), context app + memory per-user, reminder deadline
- ✅ **CardModal lengkap** (lihat tabel di atas), warna deadline 🔴telat 🟡≤3hari 🔵jauh 🍦kosong 🟢selesai
- ✅ **3 tema** Light/System/Night (dark ala Claude) — toggle di sidebar bawah
- ✅ Upload file ke server (bukan base64), NumberFlow, ErrorBoundary, animasi (stagger, confetti, blob, heatmap)
- ✅ E2E lolos: daftar → login → clock in → reload → data tetap ada

## 3. BUG YANG SUDAH DIPERBAIKI (jangan diulang)

1. **Crash putih pasca-login**: board dari server tanpa `columns` → `undefined.map`. Fix: normalisasi di `useBoard` (`columns: Array.isArray(...) ? ... : []`)
2. **Mutasi pertama nggak ke-save**: flag skip-save di `useServerState` memakan perubahan user pertama saat server kosong. Fix: `fromServerRef` hanya di-set saat setState berasal dari server
3. Model Claude ID salah (`claude-haiku-4-5` → harus `claude-haiku-4-5-20251001`)
4. `board.py` legacy pakai `session.cursor()` (invalid) — route nggak dipakai lagi, diganti `/api/state`

## 4. GOTCHA (hal aneh yang sudah diketahui)

1. **venv punya 2 interpreter** (python3.11 & 3.14). `pip` default install ke 3.14, server jalan di 3.11 → ModuleNotFoundError. **Selalu**: `venv/bin/python -m pip install ...`
2. **StrictMode** double-mount → GET state dobel saat dev (harmless)
3. Hooks-order warning di console = artefak HMR, hilang setelah reload
4. Port 5173 & 8000 sering "in use" dari sesi lama → `lsof -ti:5173 | xargs kill`
5. ⚠️ **API key Anthropic sempat terekspos** (pernah tampil di chat/screenshot) → **ROTATE di console.anthropic.com sebelum live** (di git history aman, `.env` tidak pernah ter-commit)
6. CSS pakai pola append-override — kalau edit style, cari **occurrence TERAKHIR** selector di App.css

## 5. ROADMAP SISA (kerjakan berurutan)

### Fase 2 — GO LIVE (berikutnya, ~cepat)
- [ ] 2.1 Rotate API key Anthropic (manual)
- [ ] 2.2 Deploy backend: Dockerfile sudah ada → Railway/Coolify/Render + PostgreSQL (Supabase/Neon). Set env: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SECRET_KEY`, `FRONTEND_ORIGINS=https://domain-frontend`
- [ ] 2.3 Deploy frontend: Vercel, env `VITE_API_BASE_URL=https://api-domain` (tanpa proxy, apiUrl sudah support)
- [ ] 2.4 Smoke test produksi: daftar→login→CRUD→reload→AI chat
- [ ] ⚠️ Upload file di filesystem container = hilang saat redeploy → pakai volume persistent atau pindah S3/Supabase Storage

### Fase 3 — Kolaborasi (fitur share yang diminta owner)
- [ ] 3.1 Share board via invite link — tabel `board_shares` SUDAH ADA di DB (owner_id, board_id, invited_email, token, role viewer/editor). Butuh: endpoint create/accept invite + UI tombol Share di topbar board
- [ ] 3.2 Karena data boards = blob per-user, share butuh refactor: pindahkan boards ke tabel sendiri (`boards: id, owner_id, label, columns_json`) supaya bisa diakses lintas user. `user_state['boards']` tinggal simpan urutan/activeId
- [ ] 3.3 Realtime: WebSocket room per board (FastAPI `websockets` native) — broadcast patch saat PUT
- [ ] 3.4 Presence + nama user beneran di komentar (CardModal sudah terima prop `user`)

### Fase 4 — Polish
- [ ] Mobile responsive (sidebar drawer, board scroll-snap)
- [ ] Empty/loading/error states + toast notification ("tersimpan ✓")
- [ ] Ganti `confirm()` browser → modal custom
- [ ] Onboarding user baru, keyboard shortcuts (n, /, cmd+k), undo delete
- [ ] Cleanup: hapus Groq legacy di backend, konsolidasi App.css, pecah App.jsx/CardModal.jsx, hapus `PAGE_TITLES.activity`
- [ ] Notifikasi deadline, export CSV/JSON, template board, bulk action

## 6. KONVENSI

- **Bahasa UI & komentar**: Indonesia gaul (gue/lo) — konsisten, jangan campur formal
- **Tema**: cream `#FAF9F5`, ink `#1C1B18`, oranye Claude `#C96442`/`#D97757`, serif buat greeting (`--font-serif`), radius besar (10–22px), shadow lembut
- **Commit**: deskriptif bahasa Inggris, repo `github.com/artnesh06/yourspace` branch `main`
- **Jangan pakai dependency baru** kalau stdlib/yang ada cukup (auth sengaja zero-dep)
- Owner produk: **Anesh** (`artnesh06@gmail.com`) — suka kejutan visual, animasi, dan progress report persentase di tiap update

> Progress: ██████████████░░░░░░ **~72%** — sisa: deploy (Fase 2), share+realtime (Fase 3), polish (Fase 4).
