import { useState } from 'react'
import { fmtIDR } from '../hooks/useTeam'

export function TeamPage({ team, onLog }) {
  const { members, addMember, updateMember, removeMember } = team
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', salary: '' })

  function handleAdd(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const m = addMember(form.name, form.role || 'Member', Number(form.salary) || 5000000)
    onLog('team', `Anggota baru: ${m.name} (${m.role})`)
    setForm({ name: '', role: '', salary: '' })
    setAdding(false)
  }

  function handleRemove(m) {
    if (m.id === 'anesh') return alert('Owner nggak bisa dihapus 😄')
    if (confirm(`Hapus ${m.name} dari tim?`)) {
      removeMember(m.id)
      onLog('team', `${m.name} dihapus dari tim`)
    }
  }

  return (
    <div className="page-frame">
      <div className="page-scroll">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Tim</h1>
            <p className="page-sub">{members.length} anggota · kelola role & gaji pokok di sini.</p>
          </div>
          <button className="btn-primary" onClick={() => setAdding(v => !v)}>
            {adding ? 'Batal' : '+ Tambah anggota'}
          </button>
        </div>

        {adding && (
          <form className="team-add-form" onSubmit={handleAdd}>
            <input autoFocus placeholder="Nama…" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input placeholder="Role (mis. Designer)" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            <input placeholder="Gaji pokok / bulan (angka)" type="number" value={form.salary}
              onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} />
            <button type="submit" className="btn-primary">Simpan</button>
          </form>
        )}

        <div className="team-grid">
          {members.map((m, i) => (
            <div key={m.id} className="team-card anim-pop" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="team-card-top">
                <span className="team-avatar" style={{ background: m.color }}>{m.name[0].toUpperCase()}</span>
                <div className="team-card-info">
                  <span className="team-name">{m.name}</span>
                  <span className="team-role">{m.role}</span>
                </div>
                {m.id !== 'anesh' && (
                  <button className="row-delete" title="Hapus" onClick={() => handleRemove(m)}>×</button>
                )}
              </div>
              <div className="team-card-stats">
                <div className="team-stat">
                  <span className="team-stat-label">Gaji pokok</span>
                  <input
                    className="team-salary-input"
                    type="number"
                    value={m.salary}
                    onChange={e => updateMember(m.id, { salary: Number(e.target.value) || 0 })}
                  />
                  <span className="team-stat-fmt">{fmtIDR(m.salary)}/bln</span>
                </div>
                <div className="team-stat">
                  <span className="team-stat-label">Bergabung</span>
                  <span className="team-stat-value">{new Date(m.joined + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="page-tip">💡 Coba bilang ke AI chat: <em>"tambahin anggota tim namanya Budi, role Designer, gaji 7 juta"</em></p>
      </div>
    </div>
  )
}
