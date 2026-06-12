import { useState } from 'react'

function ClaudeStar({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="claude-star-spin">
      {Array.from({ length: 11 }).map((_, i) => {
        const a = ((i * 360) / 11 - 90) * Math.PI / 180
        const len = i % 3 === 0 ? 9.6 : i % 3 === 1 ? 8.2 : 8.9
        return (
          <line key={i}
            x1={12 + Math.cos(a) * 2.4} y1={12 + Math.sin(a) * 2.4}
            x2={12 + Math.cos(a) * len} y2={12 + Math.sin(a) * len}
            stroke="#D97757" strokeWidth="2.5" strokeLinecap="round" />
        )
      })}
    </svg>
  )
}

export function AuthPage({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'register') await onRegister(name, email, password)
      else await onLogin(email, password)
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card anim-in">
        <div className="auth-head">
          <ClaudeStar />
          <h1 className="auth-title">Your Space</h1>
          <p className="auth-sub">
            {mode === 'login' ? 'Selamat datang kembali 👋' : 'Bikin akun — gratis, langsung jalan'}
          </p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>
            Masuk
          </button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>
            Daftar
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="auth-field">
              <span>Nama</span>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="Nama lo" required minLength={2} />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input autoFocus={mode === 'login'} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@contoh.com" required />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Minimal 6 karakter' : '••••••••'} required minLength={6} />
          </label>

          {error && <p className="auth-error">⚠️ {error}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Sebentar…' : mode === 'login' ? 'Masuk →' : 'Bikin akun →'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login'
            ? <>Belum punya akun? <button onClick={() => { setMode('register'); setError('') }}>Daftar di sini</button></>
            : <>Udah punya akun? <button onClick={() => { setMode('login'); setError('') }}>Masuk</button></>}
        </p>
      </div>
    </div>
  )
}
