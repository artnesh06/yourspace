// ── Deadline status & colors ──────────────────────────────────────
// merah  = telat / hari H
// kuning = mendekati hari H (≤ 3 hari)
// biru   = terjadwal masih jauh
// krem   = belum ada deadline
// hijau  = selesai

const MONTH_ABBR = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5,
  jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
}

// legacy "15 Apr" → Date (tahun berjalan)
export function parseLegacyDue(due) {
  if (!due) return null
  const m = String(due).trim().match(/^(\d{1,2})\s+([A-Za-z]+)/)
  if (!m) return null
  const mon = MONTH_ABBR[m[2].slice(0, 3).toLowerCase()]
  if (mon === undefined) return null
  const d = new Date()
  d.setMonth(mon, parseInt(m[1], 10))
  d.setHours(23, 59, 0, 0)
  return d
}

export function dueDate(card) {
  if (card.dueAt) return new Date(card.dueAt)
  return parseLegacyDue(card.due)
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// → 'done' | 'late' | 'today' | 'soon' | 'scheduled' | 'none'
export function dueStatus(card) {
  if (card.posted) return 'done'
  const t = dueDate(card)
  if (!t) return 'none'
  const now = new Date()
  const dayDiff = Math.round((startOfDay(t) - startOfDay(now)) / 86400000)
  if (dayDiff < 0) return 'late'
  if (dayDiff === 0) return t < now ? 'late' : 'today'
  if (dayDiff <= 3) return 'soon'
  return 'scheduled'
}

// status → css suffix (warna)
export const STATUS_COLOR = {
  done: 'green', late: 'red', today: 'red',
  soon: 'yellow', scheduled: 'blue', none: 'cream',
}

export const STATUS_LABEL = {
  done: 'Selesai', late: 'Telat', today: 'Hari ini', soon: 'Due soon',
}

export function fmtDT(iso, withTime = true) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  if (!withTime) return date
  return `${date}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
}

// chip text: "11 Jun – 12 Jun, 13.30" / "12 Jun, 13.30" / legacy "15 Apr"
export function fmtDueRange(card) {
  if (card.dueAt) {
    return card.startAt
      ? `${fmtDT(card.startAt, false)} – ${fmtDT(card.dueAt)}`
      : fmtDT(card.dueAt)
  }
  return card.due || ''
}

// short untuk badge di kanban card: "12 Jun"
export function fmtDueShort(card) {
  if (card.dueAt) return fmtDT(card.dueAt, false)
  return card.due || ''
}

export function stripHtml(html) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || '').trim()
}
