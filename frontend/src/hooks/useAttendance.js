import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'ys-attendance-v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fresh start */ }
  return { records: [] }
}

function save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function genId() {
  return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

export function durationMs(rec) {
  if (!rec?.in) return 0
  const end = rec.out || Date.now()
  return Math.max(0, end - rec.in)
}

export function fmtDuration(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h === 0) return `${m}m`
  return `${h}j ${m}m`
}

export function useAttendance() {
  const [state, setState] = useState(load)

  useEffect(() => { save(state) }, [state])

  const todayRecord = state.records.find(r => r.date === todayKey() && !r.out)
    || state.records.filter(r => r.date === todayKey()).slice(-1)[0]
  const isClockedIn = !!state.records.find(r => r.date === todayKey() && r.in && !r.out)

  const clockIn = useCallback(() => {
    let ok = false
    setState(prev => {
      const open = prev.records.find(r => r.date === todayKey() && !r.out)
      if (open) return prev
      ok = true
      return { records: [...prev.records, { id: genId(), date: todayKey(), in: Date.now(), out: null }] }
    })
    return ok
  }, [])

  const clockOut = useCallback(() => {
    let ok = false
    setState(prev => {
      const open = prev.records.find(r => r.date === todayKey() && !r.out)
      if (!open) return prev
      ok = true
      return { records: prev.records.map(r => r.id === open.id ? { ...r, out: Date.now() } : r) }
    })
    return ok
  }, [])

  const deleteRecord = useCallback((id) => {
    setState(prev => ({ records: prev.records.filter(r => r.id !== id) }))
  }, [])

  // month stats
  const monthPrefix = todayKey().slice(0, 7)
  const monthRecords = state.records.filter(r => r.date.startsWith(monthPrefix))
  const monthMs = monthRecords.reduce((sum, r) => sum + durationMs(r), 0)
  const daysPresent = new Set(monthRecords.map(r => r.date)).size

  // streak: consecutive days (incl today/yesterday) with a record
  const dates = new Set(state.records.map(r => r.date))
  let streak = 0
  const cursor = new Date()
  if (!dates.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (dates.has(todayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    records: state.records,
    todayRecord, isClockedIn,
    clockIn, clockOut, deleteRecord,
    monthMs, daysPresent, streak,
  }
}
