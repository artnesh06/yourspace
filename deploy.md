# deploy.md — Handoff Dokumen Produksi artnesh.cloud

> **Untuk AI/engineer yang melanjutkan pekerjaan ini: baca file ini dari atas ke bawah, lalu lanjutkan dari bagian "LANGKAH BERIKUTNYA".**
> Update terakhir: 12 Juni 2026, 00:30 WIB · Progress total: **~70%**
> Misi owner: **push ke GitHub → otomatis deploy → notif kalau gagal.**

---

## 1. PETA INFRASTRUKTUR (kondisi saat ini, semua sudah jalan)

| Komponen | Nilai |
|---|---|
| VPS | Contabo `vmi3275470` — `161.97.156.23` — Ubuntu 24.04, 4 CPU, 8GB RAM, 150GB |
| SSH | `ssh root@161.97.156.23` — key tanpa password terpasang di Mac ini: `~/.ssh/artnesh_vps` |
| Domain | `artnesh.cloud` (registrar+DNS: Hostinger). Records: `A @`, `A deploy`, `A *` → IP VPS. CNAME `www` → `artnesh.cloud` |
| Panel deploy | Coolify v4.1.2 (image resmi) → **https://deploy.artnesh.cloud** (SSL Let's Encrypt auto) |
| Supabase | self-hosted via template Coolify, 12+ container → **https://supabase.artnesh.cloud** (login: Admin User/Password di halaman config service) |
| Backend app | FastAPI dari `github.com/artnesh06/yourspace` (base dir `/backend`) — container **HIDUP & healthy**, tapi domain ssl-nya rusak (lihat bug #1) |
| Firewall Contabo | "artnesh", attached. Allow TCP 22/80/443/8000, sisanya DROP. Panel: `new.contabo.com/network/firewall/02729910-fcfb-4113-9fb8-86f7e0d75005` |
| Firewall dalam VPS | ufw **inactive** (satu-satunya firewall = Contabo) |
| Proxy | Traefik (`coolify-proxy`) pegang port 80/443. Config dinamis: `/data/coolify/proxy/dynamic/` di VPS |

**Yang sudah dimatikan permanen (persetujuan owner):** nginx bawaan + projek lama "manthy" (pm2 `manthy-api` sudah dihapus, nginx disabled). Port 80/443 sekarang milik Traefik.

## 2. STRUKTUR DI COOLIFY (Project: "My first project" → env: production)

- **Service `supabase-srnglfzfl68zhuqcqabp3w59`** — Postgres + Auth + Storage + Studio + MinIO internal. DB container: `supabase-db-srnglfzfl68zhuqcqabp3w59`, sudah di-connect ke network `coolify` (flag `connect_to_docker_network=true`, persist).
- **App id=2 `yourspace` (uuid `g4i2pyzps0i6pm16uuhcue4c`)** — APP UTAMA backend. Build pack: **dockerfile** (`/backend/Dockerfile`, python:3.11-slim, port 8000). Deploy #8 sukses, container healthy.
  - Env penting: `DATABASE_URL=postgresql://postgres:<pw>@supabase-db-srnglfzfl68zhuqcqabp3w59:5432/postgres` (pw = `SERVICE_PASSWORD_POSTGRES` milik service supabase), `ANTHROPIC_API_KEY`, `AI_PROVIDER=claude`, `APP_BIND`, `APP_PORT`, `DEBUG`.
- **App id=1 `yourspace-DUPLIKAT-boleh-dihapus`** — duplikat tak sengaja, domain sudah dicabut, AMAN DIHAPUS via UI.

## 3. BUG AKTIF (urutan prioritas)

1. **Domain backend rusak**: field Domains app id=2 sekarang `api.artnesh.cloud` TANPA `https://` (owner mengikuti saran ChatGPT yang salah). Coolify v4 BUTUH `https://` di fqdn untuk membuat rute SSL di Traefik. **Fix: set fqdn = `https://api.artnesh.cloud` lalu Restart/Redeploy app.** (`APP_URL` TIDAK perlu — itu konvensi Laravel; backend ini FastAPI.)
2. **Jaringan Mac owner ↔ VPS putus-nyambung** sejak ~23:55 WIB — diduga proteksi DDoS Contabo ter-trigger polling SSH terlalu rajin. Server SEHAT (diverifikasi dari node luar). Mitigasi: probe jarang (≥3 menit), koneksi SSH hemat, biasanya pulih sendiri. JANGAN polling SSH tiap <30 detik.

## 4. LANGKAH BERIKUTNYA (checklist eksekusi)

### P0 — sekarang
- [ ] Fix bug #1 (fqdn https) → verifikasi `curl -I https://api.artnesh.cloud/health` = 200

### P1 — inti misi
- [ ] **Frontend**: app baru di Coolify, repo `artnesh06/yourspace`, base dir `/frontend`, static site (build `npm run build`, publish `dist`), domain `https://artnesh.cloud`, env `VITE_API_BASE_URL=https://api.artnesh.cloud` (di-bake saat build!). CORS backend harus izinkan `https://artnesh.cloud`.
- [ ] **Auto-deploy on push**: Coolify → Sources → GitHub App → install ke akun `artnesh06` → hubungkan app backend+frontend → centang auto-deploy. (Alternatif cepat: webhook URL per-app dimasukkan ke GitHub repo settings.)
- [ ] **Notifikasi gagal deploy**: Coolify → Notifications. Bawaan: Email/Telegram/Discord/Slack. **WhatsApp TIDAK ADA bawaan** (butuh gateway berbayar mis. Fonnte via webhook). MENUNGGU KEPUTUSAN OWNER: Telegram+Email dulu?
- [ ] Test end-to-end: push commit → auto-deploy jalan → simulasi gagal → notif masuk.

### P2 — beres-beres
- [ ] Hapus app id=1 (duplikat) via UI
- [ ] Hapus rule `allow-8000` firewall Contabo (dashboard sudah via domain)
- [ ] Backup otomatis DB (Coolify Settings + service Supabase → backup harian)
- [ ] Push rebrand Coolify ke `github.com/artnesh06/deploy` — repo kosong sudah ada; kredensial git ada di keychain Mac (user `artnesh06`); commit orphan branch `main` sudah disiapkan separuh di folder lokal (lihat bagian 5)

### P3 — opsional
- [ ] Pasang Coolify rebrand ke VPS menggantikan image resmi (build dari folder lokal/repo `artnesh06/deploy`)
- [ ] MinIO standalone (cek dulu: Supabase Storage sudah include MinIO internal)
- [ ] Uptime monitoring (Uptime Kuma via Coolify)

## 5. PEKERJAAN LOKAL DI MAC INI

- **Folder `~/Documents/VIBE CODE/deploy.artnesh/coolify`** = fork Coolify yang SUDAH di-rebrand "deploy.artnesh.cloud": semua teks/meta/judul diganti (130+ file), navbar dirombak 4 kelompok (Utama/Setup/Advanced/Account), label diganti (Destinations→Docker Networks, S3 Storages→Backup Storage, Sources→Git Sources), dihapus: Sponsor/Feedback/changelog/Upgrade/popup donasi. Logo: `public/artnesh-logo.svg`.
- Git: clone shallow dari coollabsio/coolify; ada orphan branch `main` setengah jadi (interrupted) — cek `git status`, `.env` lokal sudah gitignored. Tujuan push: `https://github.com/artnesh06/deploy` (kosong).
- **Dev stack lokal**: jalan via colima (vz) + docker compose (`docker-compose.yml` + `docker-compose.dev.yml`), app port **8090**, vite **5183** (digeser dari 8000/5173 karena bentrok). `docker context use colima`.
- Projek aplikasi owner: `~/Documents/VIBE CODE/YOUR SPACE` (FastAPI `backend/` + Vite `frontend/`, lihat `DEPLOYMENT.md`).

## 6. ATURAN & PREFERENSI OWNER (penting buat penerus)

- Bahasa: Indonesia santai ("gue/lo"). Owner = artnesh06@gmail.com, GitHub `artnesh06`.
- Owner minta: **setiap pesan laporan sertakan % progress + sisa checklist**.
- JANGAN minta/terima password mentah — pakai pola device-flow / ssh-copy-id (key gue: `~/.ssh/artnesh_vps`).
- Sebelum matikan/hapus sesuatu yang mungkin dipakai → tanya owner dulu (preseden: kasus "manthy").
- Build backend WAJIB pakai Dockerfile, bukan Nixpacks (nixpacks gagal `pip not found` karena custom install command).
- Jangan percaya saran generik soal Coolify tanpa cek source (fqdn HARUS pakai `https://`; APP_URL tidak berlaku untuk FastAPI).
- Akses ke DB Coolify untuk inspeksi/perbaikan: `ssh ... 'docker exec coolify php artisan tinker --execute="..."'` — pola yang terbukti jalan.

## 7. URL CEPAT

| Apa | URL |
|---|---|
| Panel | https://deploy.artnesh.cloud |
| Supabase Studio | https://supabase.artnesh.cloud |
| Backend (target) | https://api.artnesh.cloud (`/health` buat healthcheck) |
| Frontend (target) | https://artnesh.cloud |
| Repo app | https://github.com/artnesh06/yourspace |
| Repo panel rebrand | https://github.com/artnesh06/deploy (masih kosong) |
| Firewall Contabo | https://new.contabo.com/network/firewall/02729910-fcfb-4113-9fb8-86f7e0d75005 |
| DNS Hostinger | https://hpanel.hostinger.com/domain/artnesh.cloud/dns |
