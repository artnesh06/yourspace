import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../lib/api'

const SAVE_DEBOUNCE = 800

/**
 * State yang source of truth-nya di server (per user).
 * - Load sekali dari GET /api/state/{key}
 * - Kalau server kosong & ada data localStorage lama (legacyKey) → migrasi otomatis
 * - Tiap perubahan di-save debounced via PUT
 *
 * return [state, setState, { loading, error }]
 */
export function useServerState(key, defaultValue, legacyKey = null) {
  const [state, setState] = useState(defaultValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadedRef = useRef(false)
  const timerRef = useRef(null)
  // skip save HANYA untuk state yang barusan dateng dari server (bukan mutasi user)
  const fromServerRef = useRef(false)

  // ── initial load ──
  useEffect(() => {
    let alive = true
    apiFetch(`/api/state/${key}`)
      .then(res => {
        if (!alive) return
        if (res.data !== null && res.data !== undefined) {
          fromServerRef.current = true
          setState(res.data)
        } else if (legacyKey) {
          // migrasi dari localStorage lama (sekali jalan) — langsung push ke server
          try {
            const raw = localStorage.getItem(legacyKey)
            if (raw) {
              loadedRef.current = true
              setState(JSON.parse(raw))
            }
          } catch { /* data korup, pakai default */ }
        }
        loadedRef.current = true
      })
      .catch(err => { if (alive) setError(err.message); loadedRef.current = true })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // ── debounced save ──
  useEffect(() => {
    if (!loadedRef.current) return
    if (fromServerRef.current) { fromServerRef.current = false; return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      apiFetch(`/api/state/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ data: state }),
      }).catch(err => setError(err.message))
    }, SAVE_DEBOUNCE)
    return () => clearTimeout(timerRef.current)
  }, [state, key])

  const set = useCallback((updater) => {
    setState(prev => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  return [state, set, { loading, error }]
}
