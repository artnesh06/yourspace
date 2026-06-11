import { useState, useEffect, useMemo } from 'react'
import { fmtDuration } from '../hooks/useAttendance'
import { relTime } from '../hooks/useActivity'
import NumberFlow from '../components/NumberFlow-standalone'

function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

const TYPE_META = {
  card:   { icon: '🃏', label: 'Card' },
  column: { icon: '📊', label: 'Kolom' },
  board:  { icon: '🌿', label: 'Board' },
  absen:  { icon: '🕐', label: 'Absen' },
  team:   { icon: '👥', label: 'Tim' },
  ai:     { icon: '✦', label: 'AI' },
  system: { icon: '⚙️', label: 'Sistem' },
}

/* ── Progress ring ────────────────────────────────────────────── */
function ProgressRing({ pct, size = 64 }) {
  const [animPct, setAnimPct] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 150)
    return () => clearTimeout(t)
  }, [pct])
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--claude-soft)" strokeWidth="7" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--claude-orange)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - animPct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.32,.72,.32,1)' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="progress-ring-label">
        {pct}%
      </text>
    </svg>
  )
}

/* ── GitHub-style heatmap ─────────────────────────────────────── */
const HEAT_COLORS = ['var(--claude-soft)', '#F6DACD', '#EDA98C', '#D97757', '#B5532F']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const WEEKS = 26

function dateKey(d) { return d.toISOString().slice(0, 10) }

function Heatmap({ counts, total }) {
  // center today, past on left/top, future on right/bottom
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date()
    const dow = (today.getDay() + 6) % 7 // 0 = Monday
    const todayCol = Math.floor(WEEKS / 2) - 1 // put today near center
    const start = new Date(today)
    start.setDate(start.getDate() - (todayCol * 7 + dow))

    const weeks = []
    const monthLabels = []
    let lastMonth = -1
    for (let w = 0; w < WEEKS; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(start)
        day.setDate(start.getDate() + w * 7 + d)
        const future = day > today
        const isToday = dateKey(day) === dateKey(today)
        col.push({ key: dateKey(day), count: counts[dateKey(day)] || 0, future, date: day, isToday })
      }
      const m = col[0].date.getMonth()
      monthLabels.push(m !== lastMonth ? MONTH_SHORT[m] : '')
      lastMonth = m
      weeks.push(col)
    }
    return { weeks, monthLabels }
  }, [counts])

  const level = (n) => n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4

  return (
    <section className="home-panel anim-in" style={{ animationDelay: '200ms' }}>
      <div className="heatmap-head">
        <h3 className="panel-title" style={{ marginBottom: 0 }}>{total} aktivitas dalam 6 bulan terakhir</h3>
        <div className="heatmap-legend">
          Sepi
          {HEAT_COLORS.map((c, i) => <span key={i} className="heat-cell" style={{ background: c }} />)}
          Rame
        </div>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-months">
          {monthLabels.map((m, i) => <span key={i} className="heatmap-month">{m}</span>)}
        </div>
        <div className="heatmap-grid">
          <div className="heatmap-dows">
            <span>Sen</span><span /><span>Rab</span><span /><span>Jum</span><span /><span />
          </div>
          {weeks.map((col, wi) => (
            <div key={wi} className="heatmap-col">
              {col.map(cell => (
                <span
                  key={cell.key}
                  className={`heat-cell ${cell.future ? 'future' : ''} ${cell.isToday ? 'today-cell' : ''}`}
                  style={{ background: cell.future ? 'transparent' : HEAT_COLORS[level(cell.count)], animationDelay: `${wi * 14}ms` }}
                  title={`${cell.key}${cell.isToday ? ' (Today)' : ''} — ${cell.count} aktivitas`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Bar chart: aktivitas 7 hari ──────────────────────────────── */
function WeekChart({ counts }) {
  const days = useMemo(() => {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      out.push({
        label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
        count: counts[dateKey(d)] || 0,
        isToday: i === 0,
      })
    }
    return out
  }, [counts])
  const max = Math.max(1, ...days.map(d => d.count))

  return (
    <div className="week-chart">
      {days.map((d, i) => (
        <div key={i} className="week-bar-wrap">
          <span className="week-bar-count">{d.count > 0 ? d.count : ''}</span>
          <div className="week-bar-track">
            <div
              className={`week-bar ${d.isToday ? 'today' : ''}`}
              style={{ height: `${Math.max(6, (d.count / max) * 100)}%`, animationDelay: `${i * 70}ms` }}
            />
          </div>
          <span className={`week-bar-label ${d.isToday ? 'today' : ''}`}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Home ─────────────────────────────────────────────────────── */
export function HomePage({ boards, board, attendance, team, activity, onNavigate, onOpenChat }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const allCards = board.columns.flatMap(c => c.cards)
  const doneCards = allCards.filter(c => c.posted)
  const pct = allCards.length ? Math.round((doneCards.length / allCards.length) * 100) : 0
  const dueCards = allCards.filter(c => c.due && !c.posted).slice(0, 5)

  // heatmap data: activity entries + kehadiran
  const heatCounts = useMemo(() => {
    const map = {}
    for (const e of activity.entries) {
      const k = new Date(e.ts).toISOString().slice(0, 10)
      map[k] = (map[k] || 0) + 1
    }
    for (const r of attendance.records) {
      map[r.date] = (map[r.date] || 0) + 1
    }
    return map
  }, [activity.entries, attendance.records])
  const heatTotal = Object.values(heatCounts).reduce((s, n) => s + n, 0)

  const feed = activity.entries.slice(0, 8)

  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="page-frame">
      <div className="page-scroll home-scroll">

        {/* floating decorations */}
        <div className="home-blob blob-1" />
        <div className="home-blob blob-2" />

        {/* Greeting */}
        <div className="home-hero anim-in">
          <div>
            <h1 className="home-greeting">
              <svg className="home-star" width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {Array.from({ length: 11 }).map((_, i) => {
                  const a = ((i * 360) / 11 - 90) * Math.PI / 180
                  return <line key={i} x1={12 + Math.cos(a) * 2.4} y1={12 + Math.sin(a) * 2.4} x2={12 + Math.cos(a) * 9.4} y2={12 + Math.sin(a) * 9.4} stroke="#D97757" strokeWidth="2.4" strokeLinecap="round" />
                })}
              </svg>
              {greeting(now)}, Anesh
            </h1>
            <p className="home-date">{dateStr}</p>
          </div>
          <div className="home-clock" title="Jam lokal">{timeStr}</div>
        </div>

        {/* Stat cards */}
        <div className="home-stats">
          <div className="stat-card anim-in" style={{ animationDelay: '60ms' }}>
            <div className="stat-label">Total task</div>
            <div className="stat-value"><NumberFlow value={allCards.length} /></div>
            <div className="stat-sub">{boards.length} board aktif</div>
          </div>
          <div className="stat-card anim-in" style={{ animationDelay: '120ms' }}>
            <div className="stat-label">Selesai</div>
            <div className="stat-value"><NumberFlow value={doneCards.length} /></div>
            <div className="stat-sub">{allCards.length - doneCards.length} tersisa</div>
          </div>
          <div className="stat-card anim-in" style={{ animationDelay: '180ms' }}>
            <div className="stat-label">Jam kerja bulan ini</div>
            <div className="stat-value">{fmtDuration(attendance.monthMs)}</div>
            <div className="stat-sub">{attendance.daysPresent} hari hadir · streak {attendance.streak} 🔥</div>
          </div>
          <div className="stat-card stat-card-ring anim-in" style={{ animationDelay: '240ms' }}>
            <div>
              <div className="stat-label">Progress board</div>
              <div className="stat-sub" style={{ marginTop: 6 }}>{doneCards.length}/{allCards.length} task done</div>
            </div>
            <ProgressRing pct={pct} />
          </div>
        </div>

        {/* Heatmap */}
        <div style={{ marginTop: 12 }}>
          <Heatmap counts={heatCounts} total={heatTotal} />
        </div>

        <div className="home-grid">
          {/* Aktivitas 7 hari chart */}
          <section className="home-panel anim-in" style={{ animationDelay: '280ms' }}>
            <h3 className="panel-title">Aktivitas 7 hari terakhir</h3>
            <WeekChart counts={heatCounts} />
          </section>

          {/* Kolom breakdown */}
          <section className="home-panel anim-in" style={{ animationDelay: '340ms' }}>
            <h3 className="panel-title">Board sekarang</h3>
            <div className="col-breakdown">
              {board.columns.map((col, i) => {
                const max = Math.max(1, ...board.columns.map(c => c.cards.length))
                return (
                  <div key={col.id} className="col-breakdown-row">
                    <span className="col-breakdown-name">{col.title}</span>
                    <div className="col-breakdown-bar">
                      <div className="col-breakdown-fill grow-in" style={{ width: `${(col.cards.length / max) * 100}%`, animationDelay: `${400 + i * 90}ms` }} />
                    </div>
                    <span className="col-breakdown-count">{col.cards.length}</span>
                  </div>
                )
              })}
            </div>
            <button className="panel-link" onClick={() => onNavigate('board')}>Buka board →</button>
          </section>

          {/* Deadline */}
          <section className="home-panel anim-in" style={{ animationDelay: '400ms' }}>
            <h3 className="panel-title">Deadline terdekat</h3>
            {dueCards.length === 0
              ? <p className="panel-empty">Nggak ada deadline aktif 🎉</p>
              : (
                <ul className="deadline-list">
                  {dueCards.map(c => (
                    <li key={c.id} className="deadline-item">
                      <span className="deadline-dot" />
                      <span className="deadline-title">{c.title}</span>
                      <span className="deadline-date">{c.due}</span>
                    </li>
                  ))}
                </ul>
              )}
            <button className="panel-link" onClick={() => onNavigate('calendar')}>Lihat kalender →</button>
          </section>

          {/* Quick actions */}
          <section className="home-panel anim-in" style={{ animationDelay: '460ms' }}>
            <h3 className="panel-title">Aksi cepat</h3>
            <div className="quick-actions">
              <button className="quick-action" onClick={() => onNavigate('absen')}>
                <span className="qa-emoji">{attendance.isClockedIn ? '🟢' : '🕐'}</span>
                {attendance.isClockedIn ? 'Lagi kerja — lihat absen' : 'Clock in sekarang'}
              </button>
              <button className="quick-action" onClick={() => onNavigate('payroll')}>
                <span className="qa-emoji">💰</span> Cek gaji bulan ini
              </button>
              <button className="quick-action" onClick={onOpenChat}>
                <span className="qa-emoji">✦</span> Tanya AI assistant
              </button>
            </div>
            <div className="home-team-row">
              {team.members.map(m => (
                <span key={m.id} className="mini-avatar" style={{ background: m.color }} title={`${m.name} — ${m.role}`}>
                  {m.name[0].toUpperCase()}
                </span>
              ))}
              <span className="home-team-label">{team.members.length} anggota tim</span>
            </div>
          </section>
        </div>

        {/* Activity feed */}
        <section className="home-panel anim-in" style={{ marginTop: 12, animationDelay: '520ms' }}>
          <div className="feed-head">
            <h3 className="panel-title" style={{ marginBottom: 0 }}>Aktivitas terbaru</h3>
            {activity.entries.length > 0 && (
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => confirm('Bersihkan semua riwayat?') && activity.clear()}>
                Bersihkan
              </button>
            )}
          </div>
          {feed.length === 0 ? (
            <p className="panel-empty">Belum ada aktivitas — pindahin card, clock in, atau ngobrol sama AI, semua kecatat di sini.</p>
          ) : (
            <div className="activity-feed">
              {feed.map((e, i) => (
                <div key={e.id} className="activity-item anim-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="activity-icon">{TYPE_META[e.type]?.icon || '•'}</span>
                  <div className="activity-body">
                    <p className="activity-text">{e.text}</p>
                    <span className="activity-time">{relTime(e.ts)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
