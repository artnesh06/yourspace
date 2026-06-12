# Your Space

Your Space adalah workspace app untuk content board, kanban, calendar, attendance, payroll, team, dan AI assistant.

## Jalanin Lokal

Pakai helper dari root project:

```bash
cd "/Users/user/Documents/VIBE CODE/YOUR SPACE"
./start-local.sh
```

Script ini menyalakan:

- Backend FastAPI di `http://127.0.0.1:8000`
- Frontend Vite mulai dari `http://127.0.0.1:5173`

Kalau port `5173` sedang dipakai, Vite otomatis naik ke port berikutnya, misalnya `5174`. Buka URL yang muncul di terminal.

Cek backend:

```bash
http://127.0.0.1:8000/health
```

Kalau hasilnya `{"status":"healthy"}`, register/login lokal harusnya bisa jalan.

## Batas Folder

Supaya file nggak nyampur:

- `frontend/` buat UI React/Vite.
- `backend/` buat API FastAPI, auth, database, upload, dan logic server.
- `backend/data/` buat data lokal runtime. Isi sensitif/generated seperti `.secret`, memory user, upload, dan database lokal tidak ikut commit.
- `frontend/src/` buat source UI yang aktif.
- `frontend/src_backup_*/` buat backup lokal sementara dan di-ignore.
- `frontend/dist/`, `frontend/node_modules/`, dan `backend/venv/` hasil build/dependency lokal dan di-ignore.
- `css/` dan `js/` adalah folder legacy/static lama. Jangan taruh kode app baru di sana kecuali memang sengaja maintain versi lama.

## Dokumen

- `yourspace.md` berisi AI handoff, product doc, status fitur, dan roadmap.
- `DEPLOYMENT.md` berisi panduan deployment teknis.
- `../deploy.artnesh/docs/production-roadmap.md` berisi roadmap infra/production `artnesh.cloud`.

## Catatan Deploy

Frontend Vite butuh `VITE_API_BASE_URL` yang mengarah ke backend production. Untuk local helper, env ini otomatis diarahkan ke `http://127.0.0.1:8000`.
