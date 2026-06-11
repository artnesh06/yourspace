import { useState, useMemo } from 'react'

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const MONTH_ABBR = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5,
  jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
}
const DAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

// parse "15 Apr" / "1 Des" → {day, month}
function parseDue(due) {
  if (!due) return null
  const m = due.trim().match(/^(\d{1,2})\s+([A-Za-z]+)/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const mon = MONTH_ABBR[m[2].slice(0, 3).toLowerCase()]
  if (mon === undefined || day < 1 || day > 31) return null
  return { day, month: mon }
}

export function CalendarPage({ boards, onOpenCard }) {
  const today = new Date()
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(null) // day number

  // all cards with parsed due dates across boards
  const dueMap = useMemo(() => {
    const map = {} // 'm-d' -> [{board, card}]
    for (const b of boards) {
      for (const col of b.columns) {
        for (const card of col.cards) {
          const p = parseDue(card.due)
          if (!p) continue
          const key = `${p.month}-${p.day}`
          if (!map[key]) map[key] = []
          map[key].push({ board: b, column: col, card })
        }
      }
    }
    return map
  }, [boards])

  const firstDay = new Date(view.y, view.m, 1)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  // Monday-first offset
  const offset = (firstDay.getDay() + 6) % 7

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (d) => d === today.getDate() && view.m === today.getMonth() && view.y === today.getFullYear()
  const tasksOn = (d) => dueMap[`${view.m}-${d}`] || []
  const selectedTasks = selected ? tasksOn(selected) : []

  function nav(delta) {
    setSelected(null)
    setView(v => {
      let m = v.m + delta, y = v.y
      if (m < 0) { m = 11; y-- }
      if (m > 11) { m = 0; y++ }
      return { y, m }
    })
  }

  return (
    <div className="page-frame">
      <div className="page-scroll">
        <h1 className="page-title">Kalender</h1>
        <p className="page-sub">Semua due date dari semua board, langsung kelihatan.</p>

        <div className="cal-layout">
          <section className="home-panel cal-panel">
            <div className="cal-header">
              <button className="cal-nav" onClick={() => nav(-1)}>‹</button>
              <span className="cal-month">{MONTHS_ID[view.m]} {view.y}</span>
              <button className="cal-nav" onClick={() => nav(1)}>›</button>
            </div>

            <div key={`${view.y}-${view.m}`} className="cal-grid cal-slide">
              {DAYS_ID.map(d => <div key={d} className="cal-dow">{d}</div>)}
              {cells.map((d, i) => {
                if (d === null) return <div key={`x${i}`} className="cal-cell empty" />
                const tasks = tasksOn(d)
                return (
                  <button
                    key={d}
                    className={`cal-cell ${isToday(d) ? 'today' : ''} ${selected === d ? 'selected' : ''} ${tasks.length ? 'has-tasks' : ''}`}
                    onClick={() => setSelected(selected === d ? null : d)}
                  >
                    <span className="cal-daynum">{d}</span>
                    {tasks.length > 0 && (
                      <span className="cal-dots">
                        {tasks.slice(0, 3).map((t, j) => (
                          <span key={j} className={`cal-dot ${t.card.posted ? 'done' : ''}`} />
                        ))}
                        {tasks.length > 3 && <span className="cal-more">+{tasks.length - 3}</span>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="home-panel cal-side">
            <h3 className="panel-title">
              {selected
                ? `${selected} ${MONTHS_ID[view.m]}`
                : 'Pilih tanggal'}
            </h3>
            {!selected && <p className="panel-empty">Klik tanggal yang ada titiknya buat lihat task-nya.</p>}
            {selected && selectedTasks.length === 0 && <p className="panel-empty">Nggak ada task di tanggal ini.</p>}
            {selectedTasks.map(({ board, column, card }) => (
              <button key={card.id} className="cal-task" onClick={() => onOpenCard(board.id, card)}>
                <span className={`cal-task-status ${card.posted ? 'done' : ''}`}>{card.posted ? '✓' : '○'}</span>
                <span className="cal-task-body">
                  <span className="cal-task-title">{card.title}</span>
                  <span className="cal-task-meta">🌿 {board.label} · {column.title}</span>
                </span>
              </button>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
