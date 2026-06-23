// Default: same-origin. API di-route lewat domain frontend (/api, /uploads)
// supaya nggak butuh subdomain api.* terpisah — bebas CORS dan nggak kena
// blokir proxy/firewall yang suka nutup subdomain tertentu. Set
// VITE_API_BASE_URL cuma kalau backend emang beda origin.
const rawApiBase = import.meta.env.VITE_API_BASE_URL || ''

export const API_BASE_URL = rawApiBase.replace(/\/$/, '')

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

/* ── Auth token ── */
const TOKEN_KEY = 'ys-token'

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

/* fetch dengan Bearer token; throw kalau !ok */
export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json'

  const res = await fetch(apiUrl(path), { ...options, headers })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try { detail = (await res.json()).detail || detail } catch { /* keep default */ }
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  return res.json()
}

/* upload file multipart → {url, name, size, type} */
export async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(apiUrl('/api/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  })
  if (!res.ok) throw new Error('Upload gagal')
  const data = await res.json()
  // R2 public/presigned URLs are absolute — use as-is; only relative paths
  // (e.g. /uploads/..) get the API base prepended.
  const url = /^https?:\/\//i.test(data.url) ? data.url : apiUrl(data.url)
  return { ...data, url }
}
