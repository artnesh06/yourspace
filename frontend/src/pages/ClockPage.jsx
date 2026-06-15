import { useState, useEffect, useMemo } from 'react'
import { durationMs, fmtDuration } from '../hooks/useAttendance'
import NumberFlow from '../components/NumberFlow-standalone'
import { Sparkline, BarChart } from '../components/HomeCharts'

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}
function dayKey(d) { return d.toISOString().slice(0, 10) }

/* ── Analog clock (jalan beneran) ─────────────────────────────── */
function AnalogClock({ size = 130 }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const c = size / 2
  const sec = now.getSeconds() * 6
  const min = now.getMinutes() * 6 + now.getSeconds() * 0.1
  const hr  = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="analog-clock">
      <circle cx={c} cy={c} r={c - 3} fill="var(--surface)" stroke="var(--claude-line)" strokeWidth="2" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180
        const r1 = c - 10, r2 = c - (i % 3 === 0 ? 17 : 13)
        return <line key={i} x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1} x2={c + Math.cos(a) * r2} y2={c + Math.sin(a) * r2} stroke={i % 3 === 0 ? 'var(--ink-2)' : 'var(--ink-4)'} strokeWidth={i % 3 === 0 ? 2.5 : 1.5} strokeLinecap="round" />
      })}
      <line x1={c} y1={c} x2={c + Math.cos((hr - 90) * Math.PI / 180) * (c - 42)} y2={c + Math.sin((hr - 90) * Math.PI / 180) * (c - 42)} stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <line x1={c} y1={c} x2={c + Math.cos((min - 90) * Math.PI / 180) * (c - 28)} y2={c + Math.sin((min - 90) * Math.PI / 180) * (c - 28)} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <line x1={c} y1={c} x2={c + Math.cos((sec - 90) * Math.PI / 180) * (c - 22)} y2={c + Math.sin((sec - 90) * Math.PI / 180) * (c - 22)} stroke="var(--claude-orange)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={c} cy={c} r="4" fill="var(--claude-orange)" />
    </svg>
  )
}

/* ── Confetti 🎉 ──────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#D97757', '#B5532F', '#3563C4', '#197A43', '#9C7A1D', '#6A4FC0']
function Confetti() {
  const pieces = Array.from({ length: 36 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 1.8 + Math.random() * 1.4,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rot: Math.random() * 360,
    size: 6 + Math.random() * 6,
  }))
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{
          left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          background: p.color, width: p.size, height: p.size * 0.6, transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  )
}

export function ClockPage({ attendance, onLog }) {
  const { records, isClockedIn, clockIn, clockOut, deleteRecord, monthMs, daysPresent, streak } = attendance
  const [, tick] = useState(0)
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    if (!isClockedIn) return
    const t = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [isClockedIn])

  const openRec = records.find(r => !r.out)
  const liveMs = openRec ? durationMs(openRec) : 0
  const h = String(Math.floor(liveMs / 3600000)).padStart(2, '0')
  const m = String(Math.floor((liveMs % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((liveMs % 60000) / 1000)).padStart(2, '0')

  // hours-per-day, last 7 days (for bar chart) + sparklines
  const weekly = useMemo(() => {
    const byDay = {}
    for (const r of records) byDay[r.date] = (byDay[r.date] || 0) + durationMs(r)
    const data = [], labels = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ms = byDay[dayKey(d)] || 0
      data.push(Math.round((ms / 3600000) * 10) / 10) // hours, 1 decimal
      labels.push(d.toLocaleDateString('id-ID', { weekday: 'short' }))
    }
    return { data, labels }
  }, [records])

  const weekTotalH = Math.round(weekly.data.reduce((a, b) => a + b, 0) * 10) / 10
  const avgDayH = daysPresent ? Math.round((monthMs / 3600000 / daysPresent) * 10) / 10 : 0
  const history = [...records].reverse().slice(0, 30)

  function handleClock() {
    if (isClockedIn) {
      clockOut()
      onLog('absen', 'Clock out — sesi kerja selesai')
    } else {
      clockIn()
      onLog('absen', 'Clock in — mulai kerja')
      setCelebrate(true)
      setTimeout(() => setCelebrate(false), 3200)
    }
  }

  return (
    <div className="page-frame">
      <div className="page-scroll home2">
        {celebrate && <Confetti />}

        {/* ── Hero clock ── */}
        <section className={`clock-hero2 anim-in ${isClockedIn ? 'working' : ''}`}>
          <div className="clock-hero2-aurora" />
          <div className="clock-hero2-grid" />
          <div className="clock-hero2-inner">
            <div className="clock-hero2-left">
              <div className="clock-status2">
                <span className={`clock-status-dot2 ${isClockedIn ? 'on' : ''}`} />
                {isClockedIn ? 'Sedang bekerja' : 'Belum clock in'}
              </div>
              <div className="clock-timer2">{h}:{m}:{s}</div>
              <div className="clock-since2">
                {openRec ? `mulai jam ${fmtTime(openRec.in)}` : 'Catat jam kerja lo — clock in pas mulai, out pas selesai.'}
              </div>
              <button className={`clock-btn2 ${isClockedIn ? 'out' : 'in'}`} onClick={handleClock}>
                {isClockedIn ? '■ Clock Out' : '▶ Clock In'}
              </button>
            </div>
            <div className="clock-hero2-right">
              <AnalogClock />
            </div>
          </div>
        </section>

        {/* ── Stat row ── */}
        <div className="stat2-row">
          <div className="stat2-card anim-in" style={{ animationDelay: '80ms' }}>
            <div className="stat2-head">
              <span className="stat2-label">Total bulan ini</span>
              <span className="stat2-pill" style={{ color: '#C96442', background: '#C964421a' }}>jam</span>
            </div>
            <div className="stat2-value">{fmtDuration(monthMs)}</div>
            <div className="stat2-foot">
              <span className="stat2-sub">{weekTotalH}j minggu ini</span>
              <Sparkline data={weekly.data} accent="#C96442" width={84} height={28} />
            </div>
          </div>
          <div className="stat2-card anim-in" style={{ animationDelay: '140ms' }}>
            <div className="stat2-head">
              <span className="stat2-label">Hari hadir</span>
              <span className="stat2-pill" style={{ color: '#6B8E7F', background: '#6B8E7F1a' }}>bln</span>
            </div>
            <div className="stat2-value"><NumberFlow value={daysPresent} /></div>
            <div className="stat2-foot"><span className="stat2-sub">rata-rata {avgDayH}j/hari</span></div>
          </div>
          <div className="stat2-card anim-in" style={{ animationDelay: '200ms' }}>
            <div className="stat2-head">
              <span className="stat2-label">Streak</span>
              <span className="stat2-pill" style={{ color: '#D9A04E', background: '#D9A04E1a' }}>🔥</span>
            </div>
            <div className="stat2-value"><NumberFlow value={streak} /> <span style={{ fontSize: 18 }}>hari</span></div>
            <div className="stat2-foot"><span className="stat2-sub">berturut-turut</span></div>
          </div>
        </div>

        {/* ── Weekly bar chart ── */}
        <section className="home-card anim-in" style={{ animationDelay: '260ms' }}>
          <div className="card-head">
            <h3 className="card-title"><span className="title-dot" /> Jam kerja 7 hari terakhir</h3>
            <span className="card-meta">{weekTotalH} jam total</span>
          </div>
          <BarChart data={weekly.data} labels={weekly.labels} fmt={(v) => `${v}j`} />
        </section>

        {/* ── History ── */}
        <section className="home-card anim-in" style={{ animationDelay: '320ms' }}>
          <h3 className="card-title"><span className="title-dot" /> Riwayat absen</h3>
          {history.length === 0
            ? <p className="card-empty">Belum ada riwayat. Clock in pertama lo bakal muncul di sini.</p>
            : (
              <div className="absen-timeline">
                {history.map((r, i) => (
                  <div key={r.id} className="absen-row anim-in" style={{ animationDelay: `${i * 35}ms` }}>
                    <div className="absen-row-date">
                      <span className="absen-row-day">{fmtDate(r.date)}</span>
                    </div>
                    <div className="absen-row-times">
                      <span className="absen-chip in">↓ {fmtTime(r.in)}</span>
                      <span className="absen-arrow">→</span>
                      {r.out
                        ? <span className="absen-chip out">↑ {fmtTime(r.out)}</span>
                        : <span className="absen-chip live">● live</span>}
                    </div>
                    <span className="absen-row-dur">{fmtDuration(durationMs(r))}</span>
                    <button className="absen-row-del" title="Hapus" onClick={() => deleteRecord(r.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
        </section>
      </div>
    </div>
  )
}
