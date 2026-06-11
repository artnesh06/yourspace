import { useState } from 'react'
import { fmtIDR } from '../hooks/useTeam'
import { fmtDuration } from '../hooks/useAttendance'
import NumberFlow from '../components/NumberFlow-standalone'

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// kehadiran penuh = 22 hari kerja / bulan
const FULL_DAYS = 22

export function PayrollPage({ team, attendance }) {
  const [slipFor, setSlipFor] = useState(null)
  const now = new Date()
  const monthLabel = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`

  // attendance applies to owner (Anesh); others assumed full
  const rows = team.members.map(m => {
    const isOwner = m.id === 'anesh'
    const days = isOwner ? attendance.daysPresent : FULL_DAYS
    const attendPct = Math.min(1, days / FULL_DAYS)
    const base = m.salary
    const prorated = Math.round(base * attendPct)
    const bonus = isOwner && attendance.streak >= 3 ? Math.round(base * 0.05) : 0
    return { member: m, isOwner, days, attendPct, base, prorated, bonus, total: prorated + bonus }
  })

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)
  const slip = rows.find(r => r.member.id === slipFor)

  return (
    <div className="page-frame">
      <div className="page-scroll">
        <h1 className="page-title">Payroll</h1>
        <p className="page-sub">Gaji {monthLabel} — otomatis kehitung dari data absensi.</p>

        <div className="home-stats" style={{ marginTop: 4 }}>
          <div className="stat-card anim-in">
            <div className="stat-label">Total payroll bulan ini</div>
            <div className="stat-value"><NumberFlow value={grandTotal} format={fmtIDR} /></div>
            <div className="stat-sub">{team.members.length} anggota</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Jam kerja lo</div>
            <div className="stat-value">{fmtDuration(attendance.monthMs)}</div>
            <div className="stat-sub">{attendance.daysPresent}/{FULL_DAYS} hari kerja</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Bonus streak</div>
            <div className="stat-value">{attendance.streak >= 3 ? '+5%' : '—'}</div>
            <div className="stat-sub">{attendance.streak >= 3 ? `streak ${attendance.streak} hari aktif 🔥` : 'butuh streak ≥ 3 hari'}</div>
          </div>
        </div>

        <section className="home-panel" style={{ marginTop: 18 }}>
          <h3 className="panel-title">Rincian gaji</h3>
          <table className="data-table">
            <thead>
              <tr><th>Nama</th><th>Kehadiran</th><th>Gaji pokok</th><th>Bonus</th><th>Total</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.member.id}>
                  <td>
                    <span className="payroll-name">
                      <span className="mini-avatar" style={{ background: r.member.color }}>{r.member.name[0].toUpperCase()}</span>
                      {r.member.name}
                      <span className="payroll-role">{r.member.role}</span>
                    </span>
                  </td>
                  <td>
                    <div className="attend-bar" title={`${r.days}/${FULL_DAYS} hari`}>
                      <div className="attend-fill" style={{ width: `${r.attendPct * 100}%` }} />
                    </div>
                    <span className="attend-label">{r.days}/{FULL_DAYS} hari{r.isOwner ? '' : ' (asumsi penuh)'}</span>
                  </td>
                  <td>{fmtIDR(r.base)}</td>
                  <td className={r.bonus ? 'td-bonus' : ''}>{r.bonus ? '+' + fmtIDR(r.bonus) : '—'}</td>
                  <td className="td-strong">{fmtIDR(r.total)}</td>
                  <td><button className="panel-link" onClick={() => setSlipFor(r.member.id)}>Slip →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Slip gaji modal */}
        {slip && (
          <div className="modal-overlay open" onClick={() => setSlipFor(null)}>
            <div className="slip-modal" onClick={e => e.stopPropagation()}>
              <div className="slip-head">
                <div>
                  <h3 className="slip-title">Slip Gaji</h3>
                  <p className="slip-period">{monthLabel}</p>
                </div>
                <span className="mini-avatar slip-avatar" style={{ background: slip.member.color }}>
                  {slip.member.name[0].toUpperCase()}
                </span>
              </div>
              <div className="slip-row"><span>Nama</span><b>{slip.member.name}</b></div>
              <div className="slip-row"><span>Role</span><b>{slip.member.role}</b></div>
              <div className="slip-row"><span>Kehadiran</span><b>{slip.days}/{FULL_DAYS} hari</b></div>
              <div className="slip-sep" />
              <div className="slip-row"><span>Gaji pokok</span><b>{fmtIDR(slip.base)}</b></div>
              <div className="slip-row"><span>Prorata kehadiran</span><b>{fmtIDR(slip.prorated)}</b></div>
              <div className="slip-row"><span>Bonus streak</span><b>{slip.bonus ? '+' + fmtIDR(slip.bonus) : '—'}</b></div>
              <div className="slip-sep" />
              <div className="slip-row slip-total"><span>Total diterima</span><b>{fmtIDR(slip.total)}</b></div>
              <button className="btn-primary slip-close" onClick={() => setSlipFor(null)}>Tutup</button>
            </div>
          </div>
        )}

        <p className="page-tip">💡 Gaji owner dihitung prorata dari absensi beneran. Rajin clock in = gaji penuh + bonus streak 5%.</p>
      </div>
    </div>
  )
}
