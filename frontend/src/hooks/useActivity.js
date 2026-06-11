import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'ys-activity-v1'
const MAX_ENTRIES = 300

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* fresh start */ }
  return []
}

function genId() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

export function relTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'baru saja'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} menit lalu`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam lalu`
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function useActivity() {
  const [entries, setEntries] = useState(load)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))) } catch { /* ignore */ }
  }, [entries])

  // type: card | column | board | absen | team | ai | system
  const log = useCallback((type, text) => {
    setEntries(prev => [{ id: genId(), ts: Date.now(), type, text }, ...prev].slice(0, MAX_ENTRIES))
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  return { entries, log, clear }
}
