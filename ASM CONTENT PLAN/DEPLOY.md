# Workboard Live Setup

## 1) Siapkan Supabase
1. Buat project Supabase baru.
2. Buka SQL Editor lalu jalankan file `supabase/schema.sql`.
3. Di menu Authentication aktifkan email login (magic link).
4. Tambahkan URL website kamu ke daftar Redirect URL (misal `https://workboard.domainkamu.com`).

## 2) Isi konfigurasi app
Edit `js/config.js`:

```js
window.APP_CONFIG={
  supabaseUrl:'https://PROJECT_REF.supabase.co',
  supabaseAnonKey:'SUPABASE_ANON_KEY'
};
```

## 3) Publish ke Contabo
Paling cepat: pakai VPS Contabo + Nginx untuk serve folder ini sebagai static site.

Contoh alur:
1. Upload folder project ke VPS.
2. Arahkan Nginx `root` ke folder project.
3. Aktifkan HTTPS (Let's Encrypt).
4. Pastikan domain final kamu sama dengan Redirect URL di Supabase Auth.

## 4) Catatan database
- Saat ini source of truth ada di tabel `workboard_states` (PostgreSQL Supabase).
- Browser tetap simpan cache lokal per-user agar tetap responsif.
- Kalau kamu ingin full database di Contabo juga, langkah berikutnya adalah self-host PostgreSQL + auth stack (lebih advanced dan perlu backup/monitoring sendiri).
