# Your Space — Frontend

React + Vite UI untuk Your Space.

## Cara paling gampang

Jalankan dari root project:

```bash
cd "/Users/user/Documents/VIBE CODE/YOUR SPACE"
./start-local.sh
```

Helper itu akan menyalakan backend dan frontend sekaligus.

## Frontend saja

```bash
cd frontend
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173
```

Kalau `5173` penuh, Vite bisa pakai port berikutnya seperti `5174`.

## Build

```bash
npm run build
```

Output build ada di `frontend/dist/` dan tidak ikut commit.

## Batas Folder

- `src/` adalah source UI aktif.
- `src_backup_*/` adalah backup lokal sementara dan di-ignore.
- `dist/` adalah hasil build dan di-ignore.
- `node_modules/` adalah dependency lokal dan di-ignore.
