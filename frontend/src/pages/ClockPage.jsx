import { useState, useEffect } from 'react'
import { durationMs, fmtDuration } from '../hooks/useAttendance'
import NumberFlow from '../components/NumberFlow-standalone'

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

/* ── Analog clock (jalan beneran) ─────────────────────────────── */
function AnalogClock({ size = 120 }) {
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
      <circle cx={c} cy={c} r={c - 3} fill="#FFFFFF" stroke="var(--claude-line)" strokeWidth="2" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180
        const r1 = c - 10, r2 = c - (i % 3 === 0 ? 17 : 13)
        return <line key={i} x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1} x2={c + Math.cos(a) * r2} y2={c + Math.sin(a) * r2} stroke={i % 3 === 0 ? 'var(--ink-2)' : 'var(--ink-4)'} strokeWidth={i % 3 === 0 ? 2.5 : 1.5} strokeLinecap="round" />
      })}
      <line x1={c} y1={c} x2={c + Math.cos((hr - 90) * Math.PI / 180) * (c - 38)} y2={c + Math.sin((hr - 90) * Math.PI / 180) * (c - 38)} stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <line x1={c} y1={c} x2={c + Math.cos((min - 90) * Math.PI / 180) * (c - 26)} y2={c + Math.sin((min - 90) * Math.PI / 180) * (c - 26)} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <line x1={c} y1={c} x2={c + Math.cos((sec - 90) * Math.PI / 180) * (c - 20)} y2={c + Math.sin((sec - 90) * Math.PI / 180) * (c - 20)} stroke="var(--claude-orange)" strokeWidth="1.8" strokeLinecap="round" />
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
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
          background: p.color,
          width: p.size,
          height: p.size * 0.6,
          transform: `rotate(${p.rot}deg)`,
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
      <div className="page-scroll">
        {celebrate && <Confetti />}

        <h1 className="page-title anim-in">Absensi</h1>
        <p className="page-sub anim-in">Catat jam kerja lo — clock in pas mulai, clock out pas selesai.</p>

        {/* Big clock card */}
        <div className={`clock-hero anim-in ${isClockedIn ? 'working' : ''}`} style={{ animationDelay: '80ms' }}>
          <div className="clock-hero-left">
            <div className="clock-status">
              <span className={`clock-status-dot ${isClockedIn ? 'on' : ''}`} />
              {isClockedIn ? 'Sedang bekerja' : 'Belum clock in'}
            </div>
            <div className="clock-timer">{h}:{m}:{s}</div>
            {openRec && <div className="clock-since">sejak {fmtTime(openRec.in)}</div>}
          </div>
          <AnalogClock />
          <button className={`clock-btn ${isClockedIn ? 'out' : 'in'}`} onClick={handleClock}>
            {isClockedIn ? 'Clock Out' : 'Clock In'}
          </button>
        </div>

        {/* Month stats */}
        <div className="home-stats" style={{ marginTop: 18 }}>
          <div className="stat-card anim-in" style={{ animationDelay: '160ms' }}>
            <div className="stat-label">Total bulan ini</div>
            <div className="stat-value">{fmtDuration(monthMs)}</div>
            <div className="stat-sub">jam kerja terkumpul</div>
          </div>
          <div className="stat-card anim-in" style={{ animationDelay: '220ms' }}>
            <div className="stat-label">Hari hadir</div>
            <div className="stat-value"><NumberFlow value={daysPresent} /></div>
            <div className="stat-sub">hari bulan ini</div>
          </div>
          <div className="stat-card anim-in" style={{ animationDelay: '280ms' }}>
            <div className="stat-label">Streak</div>
            <div className="stat-value"><NumberFlow value={streak} /> 🔥</div>
            <div className="stat-sub">hari berturut-turut</div>
          </div>
        </div>

        {/* History */}
        <section className="home-panel anim-in" style={{ marginTop: 18, animationDelay: '340ms' }}>
          <h3 className="panel-title">Riwayat absen</h3>
          {history.length === 0
            ? <p className="panel-empty">Belum ada riwayat. Clock in pertama lo bakal muncul di sini.</p>
            : (
              <table className="data-table">
                <thead>
                  <tr><th>Tanggal</th><th>Masuk</th><th>Keluar</th><th>Durasi</th><th /></tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.date)}</td>
                      <td>{fmtTime(r.in)}</td>
                      <td>{r.out ? fmtTime(r.out) : <span className="badge-live">live</span>}</td>
                      <td className="td-strong">{fmtDuration(durationMs(r))}</td>
                      <td>
                        <button className="row-delete" title="Hapus" onClick={() => deleteRecord(r.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>
      </div>
    </div>
  )
}
