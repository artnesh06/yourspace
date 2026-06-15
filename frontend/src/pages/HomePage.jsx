import { useState, useEffect, useMemo } from 'react'
import { fmtDuration } from '../hooks/useAttendance'
import { relTime } from '../hooks/useActivity'
import NumberFlow from '../components/NumberFlow-standalone'
import { AreaChart, Donut, ActivityRings, Sparkline, Gauge } from '../components/HomeCharts'

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

const SEGMENT_COLORS = ['#C96442', '#D9A04E', '#6B8E7F', '#8C7BB5', '#C97A8A', '#5E8CA7']

/* ── GitHub-style heatmap ─────────────────────────────────────── */
const HEAT_COLORS = ['var(--claude-soft)', '#F6DACD', '#EDA98C', '#D97757', '#B5532F']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const WEEKS = 52

function dateKey(d) { return d.toISOString().slice(0, 10) }

function Heatmap({ counts, total }) {
  const { weeks, monthLabels, rowLabels } = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - (WEEKS * 7 - 1))

    const rowLabels = []
    const startDow = start.getDay()
    for (let r = 0; r < 7; r++) rowLabels.push(WEEKDAY_SHORT[(startDow + r) % 7])

    const weeks = Array.from({ length: WEEKS }, () => Array(7))
    const monthLabels = []
    let lastMonth = -1

    for (let i = 0; i < WEEKS * 7; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      const col = Math.floor(i / 7)
      const row = i % 7
      const isToday = dateKey(day) === dateKey(today)
      weeks[col][row] = { key: dateKey(day), count: counts[dateKey(day)] || 0, date: day, isToday }
    }
    for (let w = 0; w < WEEKS; w++) {
      const m = weeks[w][0].date.getMonth()
      monthLabels.push(m !== lastMonth ? MONTH_SHORT[m] : '')
      lastMonth = m
    }
    return { weeks, monthLabels, rowLabels }
  }, [counts])

  const level = (n) => n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4

  return (
    <section className="home-card anim-in" style={{ animationDelay: '260ms' }}>
      <div className="heatmap-head">
        <h3 className="card-title" style={{ marginBottom: 0 }}>
          <span className="title-dot" /> {total} aktivitas dalam 6 bulan terakhir
        </h3>
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
        <div className="heatmap-grid" style={{ gridTemplateColumns: `30px repeat(${weeks.length}, minmax(16px, 1fr))` }}>
          <div className="heatmap-dows">
            {rowLabels.map((label, i) => <span key={i}>{label}</span>)}
          </div>
          {weeks.map((col, wi) => (
            <div key={wi} className="heatmap-col">
              {col.map(cell => (
                <span key={cell.key}
                  className={`heat-cell ${cell.isToday ? 'today-cell' : ''}`}
                  style={{ background: HEAT_COLORS[level(cell.count)], animationDelay: `${wi * 14}ms` }}
                  title={`${cell.key}${cell.isToday ? ' (Today)' : ''} — ${cell.count} aktivitas`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Home ─────────────────────────────────────────────────────── */
export function HomePage({ boards, board, attendance, team, activity, userName = 'Anesh', onNavigate, onOpenChat }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const allCards = board.columns.flatMap(c => c.cards)
  const doneCards = allCards.filter(c => c.posted)
  const pct = allCards.length ? Math.round((doneCards.length / allCards.length) * 100) : 0
  const dueCards = allCards.filter(c => c.due && !c.posted).slice(0, 5)

  // heatmap + trend data
  const heatCounts = useMemo(() => {
    const map = {}
    for (const e of activity.entries) {
      const k = new Date(e.ts).toISOString().slice(0, 10)
      map[k] = (map[k] || 0) + 1
    }
    for (const r of attendance.records) map[r.date] = (map[r.date] || 0) + 1
    return map
  }, [activity.entries, attendance.records])
  const heatTotal = Object.values(heatCounts).reduce((s, n) => s + n, 0)

  // 14-day trend
  const trend = useMemo(() => {
    const data = [], labels = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      data.push(heatCounts[dateKey(d)] || 0)
      labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))
    }
    return { data, labels }
  }, [heatCounts])

  // 7-day spark for stat cards
  const spark7 = useMemo(() => {
    const out = []
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(heatCounts[dateKey(d)] || 0) }
    return out
  }, [heatCounts])

  const donutSegments = board.columns.map((col, i) => ({
    label: col.title, value: col.cards.length, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  })).filter(s => s.value > 0)

  const rings = [
    { value: pct / 100, color: '#C96442', track: 'rgba(201,100,66,.15)' },
    { value: Math.min(1, attendance.daysPresent / 22), color: '#6B8E7F', track: 'rgba(107,142,127,.15)' },
    { value: Math.min(1, attendance.streak / 7), color: '#D9A04E', track: 'rgba(217,160,78,.15)' },
  ]

  const feed = activity.entries.slice(0, 7)
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const stats = [
    { label: 'Total task', value: allCards.length, sub: `${boards.length} board aktif`, accent: '#C96442' },
    { label: 'Selesai', value: doneCards.length, sub: `${allCards.length - doneCards.length} tersisa`, accent: '#6B8E7F' },
    { label: 'Jam kerja bulan ini', value: fmtDuration(attendance.monthMs), raw: true, sub: `${attendance.daysPresent} hari · streak ${attendance.streak} 🔥`, accent: '#D9A04E' },
  ]

  return (
    <div className="page-frame">
      <div className="page-scroll home2">

        {/* ── Hero ── */}
        <section className="hero2 anim-in">
          <div className="hero2-aurora" />
          <div className="hero2-grid-bg" />
          <div className="hero2-inner">
            <div className="hero2-left">
              <div className="hero2-eyebrow">
                <span className="live-dot" /> {dateStr}
              </div>
              <h1 className="hero2-title">
                <svg className="home-star" width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {Array.from({ length: 11 }).map((_, i) => {
                    const a = ((i * 360) / 11 - 90) * Math.PI / 180
                    return <line key={i} x1={12 + Math.cos(a) * 2.4} y1={12 + Math.sin(a) * 2.4} x2={12 + Math.cos(a) * 9.4} y2={12 + Math.sin(a) * 9.4} stroke="#D97757" strokeWidth="2.4" strokeLinecap="round" />
                  })}
                </svg>
                {greeting(now)}, {userName.split(' ')[0]}
              </h1>
              <p className="hero2-sub">{pct >= 100 ? 'Semua task kelar 🎉' : `Lo udah nyelesain ${doneCards.length} dari ${allCards.length} task — terus gas.`}</p>
              <div className="hero2-actions">
                <button className="hero2-btn primary" onClick={onOpenChat}><span>✦</span> Tanya AI</button>
                <button className="hero2-btn" onClick={() => onNavigate('board')}>Buka board →</button>
              </div>
            </div>
            <div className="hero2-clock">
              <NumberFlow value={timeStr} />
              <span className="hero2-clock-label">waktu lokal</span>
            </div>
          </div>
        </section>

        {/* ── Stat row with sparklines ── */}
        <div className="stat2-row">
          {stats.map((s, i) => (
            <div key={i} className="stat2-card anim-in" style={{ animationDelay: `${60 + i * 60}ms` }}>
              <div className="stat2-head">
                <span className="stat2-label">{s.label}</span>
                <span className="stat2-pill" style={{ color: s.accent, background: `${s.accent}1a` }}>7h</span>
              </div>
              <div className="stat2-value">
                {s.raw ? s.value : <NumberFlow value={s.value} />}
              </div>
              <div className="stat2-foot">
                <span className="stat2-sub">{s.sub}</span>
                <Sparkline data={spark7} accent={s.accent} width={84} height={28} />
              </div>
            </div>
          ))}
          <div className="stat2-card stat2-ring anim-in" style={{ animationDelay: '240ms' }}>
            <div>
              <span className="stat2-label">Progress board</span>
              <div className="stat2-value" style={{ fontSize: 22 }}><NumberFlow value={pct} />%</div>
              <span className="stat2-sub">{doneCards.length}/{allCards.length} done</span>
            </div>
            <Gauge value={pct} size={66} />
          </div>
        </div>

        {/* ── Trend + Rings ── */}
        <div className="home2-split">
          <section className="home-card span-2 anim-in" style={{ animationDelay: '160ms' }}>
            <div className="card-head">
              <h3 className="card-title"><span className="title-dot" /> Tren aktivitas 14 hari</h3>
              <span className="card-meta">{trend.data.reduce((a, b) => a + b, 0)} total</span>
            </div>
            <AreaChart data={trend.data} labels={trend.labels} />
          </section>

          <section className="home-card anim-in" style={{ animationDelay: '220ms' }}>
            <h3 className="card-title"><span className="title-dot" /> Ringkasan</h3>
            <div className="rings-block">
              <ActivityRings rings={rings} size={150} />
              <ul className="rings-legend">
                <li><span className="lg-dot" style={{ background: '#C96442' }} /> Progress <b>{pct}%</b></li>
                <li><span className="lg-dot" style={{ background: '#6B8E7F' }} /> Kehadiran <b>{attendance.daysPresent} hari</b></li>
                <li><span className="lg-dot" style={{ background: '#D9A04E' }} /> Streak <b>{attendance.streak} 🔥</b></li>
              </ul>
            </div>
          </section>
        </div>

        {/* ── Heatmap ── */}
        <Heatmap counts={heatCounts} total={heatTotal} />

        {/* ── Distribution + Deadline + AI + Activity ── */}
        <div className="home2-bottom">
          <section className="home-card area-dist anim-in" style={{ animationDelay: '300ms' }}>
            <h3 className="card-title"><span className="title-dot" /> Distribusi board</h3>
            {donutSegments.length === 0
              ? <p className="card-empty">Belum ada task</p>
              : (
                <div className="donut-block">
                  <Donut segments={donutSegments} size={150} />
                  <ul className="donut-legend">
                    {donutSegments.map((s, i) => (
                      <li key={i}>
                        <span className="lg-dot" style={{ background: s.color }} />
                        <span className="lg-name">{s.label}</span>
                        <b>{s.value}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            <button className="card-link" onClick={() => onNavigate('board')}>Buka board →</button>
          </section>

          <section className="home-card area-deadline anim-in" style={{ animationDelay: '360ms' }}>
            <h3 className="card-title"><span className="title-dot" /> Deadline terdekat</h3>
            {dueCards.length === 0
              ? <p className="card-empty">Nggak ada deadline aktif 🎉</p>
              : (
                <ul className="deadline2-list">
                  {dueCards.map(c => (
                    <li key={c.id} className="deadline2-item">
                      <span className="deadline2-dot" />
                      <span className="deadline2-title">{c.title}</span>
                      <span className="deadline2-date">{c.due}</span>
                    </li>
                  ))}
                </ul>
              )}
            <button className="card-link" onClick={() => onNavigate('board')}>Buka board →</button>
          </section>

          <section className="home-card ai-card area-ai anim-in" style={{ animationDelay: '420ms' }}>
            <div className="ai-card-glow" />
            <div className="ai-card-inner">
              <div className="ai-badge">✦ AI Assistant</div>
              <p className="ai-card-text">Tanya apa aja soal board, task, atau absen lo — gue bantu rangkum dan kasih insight.</p>
              <button className="ai-card-btn" onClick={onOpenChat}>Mulai chat →</button>
            </div>
            <div className="ai-team-row">
              {team.members.map(m => (
                <span key={m.id} className="mini-avatar2" style={{ background: m.color }} title={`${m.name} — ${m.role}`}>
                  {m.name[0].toUpperCase()}
                </span>
              ))}
              <span className="ai-team-label">{team.members.length} anggota tim</span>
            </div>
          </section>

          {/* ── Activity feed ── */}
          <section className="home-card area-activity anim-in" style={{ animationDelay: '480ms' }}>
          <div className="card-head">
            <h3 className="card-title" style={{ marginBottom: 0 }}><span className="title-dot" /> Aktivitas terbaru</h3>
            {activity.entries.length > 0 && (
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => confirm('Bersihkan semua riwayat?') && activity.clear()}>
                Bersihkan
              </button>
            )}
          </div>
          {feed.length === 0 ? (
            <p className="card-empty">Belum ada aktivitas — pindahin card, clock in, atau ngobrol sama AI, semua kecatat di sini.</p>
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
    </div>
  )
}
