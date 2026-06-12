import { useCallback } from 'react'
import { useServerState } from './useServerState'

const STORAGE_KEY = 'ys-activity-v1'
const MAX_ENTRIES = 300

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
  const [entries, setEntries] = useServerState('activity', [], STORAGE_KEY)
  const entries_ = Array.isArray(entries) ? entries : []

  // type: card | column | board | absen | team | ai | system
  const log = useCallback((type, text) => {
    setEntries(prev => [{ id: genId(), ts: Date.now(), type, text }, ...(Array.isArray(prev) ? prev : [])].slice(0, MAX_ENTRIES))
  }, [setEntries])

  const clear = useCallback(() => setEntries([]), [setEntries])

  return { entries: entries_, log, clear }
}
