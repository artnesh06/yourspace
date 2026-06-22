# Coolify Nginx Configuration untuk Your Space

## Setup Instructions

Login ke Coolify dashboard → Your Space project → Settings → Reverse Proxy

Tambah path routing:

### 1. API Routes → Backend (port 8000)
```
Path: /api
Destination: http://localhost:8000
```

### 2. Uploads → Backend (port 8000)
```
Path: /uploads
Destination: http://localhost:8000
```

### Alternative: Manual Nginx Config

Jika Coolify panel tidak ada option path routing, edit nginx config manual:

```nginx
server {
    listen 80;
    server_name yourspace.artnesh.cloud;

    # Frontend (default)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API routes
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded files
    location /uploads {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

## Environment Variables to Check

Backend should have:
- `APP_BIND=0.0.0.0`
- `APP_PORT=8000`

Frontend (Vite) should have:
- `VITE_API_BASE_URL=` (empty = same-origin)

## Test

After config:
1. Buka https://yourspace.artnesh.cloud
2. Login dengan artnesh06@gmail.com
3. Coba upload file
4. Coba AI chat set card date
