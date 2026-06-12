# YOUR SPACE — Product Doc & Roadmap to Live

> Kanban board + office management + AI assistant.
> Target: **live di internet** — orang bisa daftar, login, pakai semua fitur tanpa lag, dan share board untuk kolaborasi bareng.

Terakhir di-update: 12 Juni 2026 · **Progress keseluruhan: ~70%**

---

## 1. 📊 Status Sekarang (apa yang udah jadi)

### Halaman (7/7 aktif)
| Halaman | Status | Catatan |
|---|---|---|
| 🏠 Home | ✅ | Dashboard: greeting dinamis, jam live, stat NumberFlow, heatmap GitHub-style, chart 7 hari, deadline, feed aktivitas |
| 🔍 Search | ✅ | Gaya Claude.ai (serif + starburst), cari lintas board, Enter = tanya AI |
| ▦ Board | ✅ | Kanban multi-board, drag & drop, filter warna, cover fit + warna dominan, label strip, chip status deadline |
| 🕐 Absensi | ✅ | Clock in/out, timer live, jam analog, confetti, streak, riwayat |
| 📅 Kalender | ✅ | Plot due date semua board, navigasi bulan animasi, klik tanggal → task |
| 👥 Tim | ✅ | CRUD anggota, role, gaji pokok |
| 💳 Payroll | ✅ | Gaji prorata dari absensi + bonus streak, slip gaji |

### Pop-up Card (lengkap)
- ✅ Cover banner full-width (klik → lightbox fullscreen)
- ✅ Rich description (paste dari Docs format kebawa) + collapse "Show more"
- ✅ Date picker ala Trello (kalender + start/due + jam, layout horizontal)
- ✅ Warna status deadline: 🔴 telat/hari H · 🟡 ≤3 hari · 🔵 terjadwal · 🍦 kosong · 🟢 selesai
- ✅ Checklist + progress bar + chip "2/5" di card
- ✅ Multi-attachment (gambar + file PDF dll), drag & drop di seluruh modal
- ✅ Lightbox fullscreen (arrows, download, make cover, delete)
- ✅ Panel kiri/kanan resizable (drag divider), komentar + edit
- ✅ Copy link card (#card=ID)

### AI Assistant
- ✅ Streaming via Claude API (model bisa diganti)
- ✅ 14 tools: card/kolom CRUD, navigate page, clock in/out, add team member, save memory
- ✅ Konteks app (halaman aktif, absensi, tim) dikirim tiap pesan
- ✅ Reminder deadline otomatis pas chat dibuka
- ✅ Memory per-user (markdown di backend)

### Lainnya
- ✅ Tema Light / System / Night (dark ala Claude)
- ✅ NumberFlow rolling digits di semua stat
- ✅ Activity log lokal
- ✅ Auth lokal: daftar, login, token user, dan halaman login/register
- ✅ Local helper `start-local.sh` untuk nyalain backend + frontend sekali jalan
- ✅ Frontend dev proxy/env diarahkan ke backend `127.0.0.1:8000`
- ✅ Repo GitHub: artnesh06/yourspace

---

## 2. 🧑‍💼 Sudut Pandang Product Manager

**Masalah inti menuju live:** auth lokal sudah jalan dan state mulai pindah ke backend, tapi production persistence + sharing belum selesai. Artinya: app sudah bisa dicoba sebagai single-user lokal, tapi belum layak dibuka publik sampai database production, upload storage, dan permission share rapi.

**Prioritas (urutan eksekusi):**
1. **P0 — Auth & akun production-ready** (JWT sudah lokal; perlu hardening, CORS, rate limit, deploy env)
2. **P0 — Migrasi data ke database production** (boards, attendance, team, activity → PostgreSQL/Supabase)
3. **P0 — Deploy** (frontend Vercel, backend Railway/Fly + Postgres)
4. **P1 — Share board** (link invite: view-only / editor)
5. **P1 — Kolaborasi realtime** (websocket — lihat perubahan orang lain live)
6. **P2 — Polish**: onboarding, empty states, error states, mobile responsive
7. **P2 — Cleanup teknis** (hapus kode legacy)

**Definisi "Live & layak dipakai orang":**
- [ ] Orang asing bisa daftar → bikin board → balik besok datanya masih ada
- [ ] Share link board ke teman → teman bisa lihat/edit
- [ ] Nggak ada error di console, load < 2 detik
- [ ] AI chat jalan dengan API key di server (bukan exposed)

## 3. 🎨 Sudut Pandang UX Designer

**Yang udah bagus:** tema konsisten (cream/ink/ember), animasi halus, dark mode rapi.

**Gap yang harus dibenerin sebelum live:**
- [ ] **Mobile responsive** — sidebar & board belum dioptimalkan buat layar kecil
- [ ] **Empty states** — user baru lihat board kosong tanpa arahan; butuh onboarding ("Bikin card pertama lo")
- [ ] **Loading states** — belum ada skeleton/spinner pas data dimuat dari server
- [ ] **Error states** — kalau API mati, user cuma lihat "Error: HTTP 502" mentah
- [ ] **Konfirmasi destruktif** — masih pakai `confirm()` browser; ganti modal custom
- [ ] **Toast notifications** — feedback "tersimpan ✓" belum ada
- [ ] **Keyboard a11y** — fokus trap di modal, esc handling (sebagian udah)

## 4. 🖥 Sudut Pandang Senior Frontend Engineer

**Utang teknis:**
- [ ] **State management** — semua di localStorage + props drilling; pas pindah ke server butuh layer data (React Query/SWR) + optimistic updates
- [ ] **App.css 3.000+ baris** dengan blok duplikat (`.tm-modal` ×3, `.lightbox-img` ×2, dll — sengaja override cascade tapi harus dikonsolidasi) dan CSS mati (blok `.detail-modal` lama tidak dipakai lagi)
- [ ] **Komponen besar** — `App.jsx` ~600 baris, `CardModal.jsx` ~800; pecah jadi modul
- [ ] **Gambar sebagai base64 di localStorage** — bakal jebol quota 5MB; harus upload ke storage (S3/Supabase Storage)
- [ ] **Belum ada error boundary** React
- [ ] **Belum ada test** sama sekali

**Bug yang ketemu & status:**
- ✅ FIXED: file orphan `hooks/useCountUp.js` (sudah dihapus)
- ✅ Build vite bersih, zero error
- ⚠️ Hooks-order warning di console = artefak HMR (hilang setelah reload, bukan bug runtime)
- ⚠️ `PAGE_TITLES` masih punya entry `activity` (halaman sudah dihapus — harmless, cleanup nanti)

## 5. ⚙️ Sudut Pandang Senior Backend Engineer

**Sekarang:** FastAPI + SQLite, auth JWT lokal, state app per user, upload endpoint, chat endpoint, dan healthcheck. Local flow register/login sudah jalan saat backend `8000` dan frontend Vite aktif.

**Yang harus dibangun untuk live:**
- [x] **Auth basic lokal**: register, login, JWT/session, password hash
- [ ] **Auth hardening production**: rate limit, refresh/session policy, CORS domain produksi
- [ ] **Schema DB beneran**: users, boards, columns, cards, attachments, attendance, team_members, activity, board_shares
- [ ] **Migrasi SQLite → PostgreSQL** (Supabase/Neon — sudah ada commit "PostgreSQL support" sebelumnya, tinggal diaktifkan)
- [ ] **API CRUD per-resource** (bukan blob) + authorization check per board
- [ ] **Share & permission**: tabel `board_shares (board_id, user_id/email, role: viewer|editor)` + invite link token
- [ ] **Realtime**: WebSocket per board room (FastAPI native / Supabase Realtime)
- [ ] **File upload** endpoint → object storage, ganti base64
- [ ] **Cleanup**: hapus path Groq legacy (chat.py, chat_service.py — ~300 baris mati)
- [ ] **Security**: API key Claude di env server ✓ (sudah), CORS dikunci ke domain produksi, secrets nggak ke-commit (⚠️ `.env` berisi API key pernah ke-push — **harus rotate key & tambah .gitignore**)

## 6. 🔥 Sudut Pandang Pro User

- [ ] **Keyboard shortcuts** (n = card baru, / = search, cmd+k command palette)
- [ ] **Undo** (ctrl+z) setelah hapus card
- [ ] **Bulk action** (pilih banyak card, pindah sekaligus)
- [ ] **Export** board ke CSV/JSON
- [ ] **Notifikasi** deadline (browser notification / email)
- [ ] **Template board** (Content Plan, Sprint, OKR)

---

## 7. 🗺 ROADMAP KE LIVE (checklist master)

### Fase 1 — Fondasi (blocker, ~1 sesi panjang)
- [ ] 1.1 Schema PostgreSQL + SQLAlchemy models (users, boards, cards, dst)
- [x] 1.2 Auth API basic: register, login, me (JWT lokal)
- [x] 1.3 Halaman Login & Sign up di frontend
- [ ] 1.4 Migrasi semua hook localStorage → API production-ready (boards, absen, tim, activity)
- [ ] 1.5 Upload gambar ke storage (bukan base64)

### Fase 2 — Go Live (deploy)
- [ ] 2.1 Rotate API key Anthropic + bersihkan .env dari git history
- [ ] 2.2 Backend deploy (Railway/Fly/Render) + Postgres (Supabase/Neon)
- [ ] 2.3 Frontend deploy Vercel + env VITE_API_BASE_URL
- [ ] 2.4 Domain + HTTPS + CORS produksi
- [ ] 2.5 Smoke test end-to-end di produksi

### Fase 3 — Kolaborasi
- [ ] 3.1 Share board via invite link (viewer/editor)
- [ ] 3.2 Realtime sync (WebSocket) — card pindah kelihatan live
- [ ] 3.3 Presence ("Budi lagi lihat board ini")
- [ ] 3.4 Komentar dengan nama user beneran (bukan hardcode "Anesh")

### Fase 4 — Polish
- [ ] 4.1 Mobile responsive penuh
- [ ] 4.2 Empty/loading/error states + toast
- [ ] 4.3 Onboarding user baru
- [ ] 4.4 Cleanup: CSS konsolidasi, hapus Groq legacy, pecah komponen besar
- [ ] 4.5 Keyboard shortcuts + undo
- [ ] 4.6 Error boundary + monitoring (Sentry)

---

## 8. Arsitektur Target

```
[Browser React/Vite] ──HTTPS──> [FastAPI @ Railway]──> [PostgreSQL @ Supabase]
        │                            │                      │
        │<──── WebSocket realtime ───┤                [Storage: gambar]
        │                            └──> [Claude API (key di server)]
   [Vercel CDN]
```

## 9. Local Dev & Batas Folder

**Local start utama:**

```bash
cd "/Users/user/Documents/VIBE CODE/YOUR SPACE"
./start-local.sh
```

Kalau backend sehat, `http://127.0.0.1:8000/health` akan balikin `{"status":"healthy"}`. Frontend mulai dari `http://127.0.0.1:5173`; kalau penuh, Vite pakai port berikutnya seperti `5174`.

**Batas folder:**
- `frontend/` = UI React/Vite.
- `backend/` = FastAPI, auth, database, upload, AI/chat.
- `backend/data/` = data runtime lokal; `.secret`, memory user, upload, dan database lokal tidak ikut commit.
- `frontend/src/` = source UI aktif.
- `frontend/src_backup_*/` = backup sementara, di-ignore.
- `css/` dan `js/` = legacy/static lama; jangan campur kode app baru kecuali sengaja maintain versi lama.

**Progress: ██████████████░░░░░░ ~70%** — produk single-user udah kaya & auth lokal sudah jalan; sisa perjalanan = database production, sharing, deploy, dan polish error/loading.
