import { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import GlareHover from '../components/GlareHover'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export function AuthPage({ theme, setTheme, onLogin, onRegister, onGoogle }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [lang, setLang] = useState('id') // 'id' | 'en'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)

  // Load Google Identity Services + initialize once
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    function init() {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          if (!credential) return
          setError('')
          setBusy(true)
          try {
            await onGoogle(credential)
          } catch (err) {
            setError(err.message || 'Login Google gagal')
          } finally {
            setBusy(false)
          }
        },
      })
      setGoogleReady(true)
    }
    if (window.google?.accounts?.id) { init(); return }
    const existing = document.getElementById('gsi-script')
    if (existing) { existing.addEventListener('load', init); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.id = 'gsi-script'
    s.onload = init
    document.head.appendChild(s)
  }, [onGoogle])

  function handleGoogle() {
    if (!GOOGLE_CLIENT_ID) {
      setError(lang === 'id' ? 'Google login belum diaktifkan' : 'Google login not enabled')
      return
    }
    if (!googleReady || !window.google?.accounts?.id) {
      setError(lang === 'id' ? 'Google belum siap, coba lagi' : 'Google not ready, try again')
      return
    }
    window.google.accounts.id.prompt()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    // keep "Sebentar…" visible long enough for the slot-text roll to play
    const minBusy = new Promise(r => setTimeout(r, 650))
    try {
      const action = mode === 'register'
        ? onRegister(name, email, password)
        : onLogin(email, password)
      await Promise.all([action, minBusy])
    } catch (err) {
      await minBusy
      setError(err.message || (lang === 'id' ? 'Terjadi kesalahan' : 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'
  const text = {
    title: lang === 'id' ? 'Build with Your Space' : 'Build with Your Space',
    subtitle: lang === 'id'
      ? 'Kelola board, task, dan absen dengan AI.'
      : 'Manage boards, tasks, and attendance with AI.',
    loginTab: lang === 'id' ? 'Masuk' : 'Login',
    registerTab: lang === 'id' ? 'Daftar' : 'Sign up',
    nameLabel: lang === 'id' ? 'Nama' : 'Name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    emailPlaceholder: 'Enter your email',
    passwordPlaceholder: isLogin
      ? (lang === 'id' ? '••••••••' : '••••••••')
      : (lang === 'id' ? 'Minimal 6 karakter' : 'Min 6 characters'),
    submit: busy
      ? (lang === 'id' ? 'Sebentar…' : 'One moment…')
      : isLogin
        ? (lang === 'id' ? 'Continue with email' : 'Continue with email')
        : (lang === 'id' ? 'Create account' : 'Create account'),
    switchText: isLogin
      ? (lang === 'id' ? 'Belum punya akun?' : "Don't have an account?")
      : (lang === 'id' ? 'Udah punya akun?' : 'Already have an account?'),
    switchButton: isLogin
      ? (lang === 'id' ? 'Daftar di sini' : 'Sign up here')
      : (lang === 'id' ? 'Masuk' : 'Login'),
    toggleTheme: theme === 'dark'
      ? (lang === 'id' ? 'Mode terang' : 'Light mode')
      : (lang === 'id' ? 'Night mode' : 'Night mode'),
    toggleLang: lang === 'id' ? 'ENG' : 'IDN',
  }

  return (
    <div className="auth-page">

<main className="auth-main">
        <section className="auth-hero">
          <h1 className="auth-hero-title">
            <Logo className="auth-hero-logo" />
            Yourspace
          </h1>
          <p>{text.subtitle}</p>
        </section>

        <div className="auth-card anim-in">
        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>
            {text.loginTab}
          </button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>
            {text.registerTab}
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <GlareHover
            width="100%"
            height="48px"
            background="var(--auth-ghost)"
            borderRadius="10px"
            borderColor="var(--auth-line)"
            glareColor="#ffffff"
            glareOpacity={0.25}
            glareAngle={-45}
            transitionDuration={600}
          >
            <button type="button" onClick={handleGoogle} disabled={busy} className="auth-google-btn" style={{ background: 'transparent', border: 'none', width: '100%', height: '100%', transition: 'transform .08s' }} onMouseDown={e => e.currentTarget.style.transform='scale(0.97)'} onMouseUp={e => e.currentTarget.style.transform=''} onMouseLeave={e => e.currentTarget.style.transform=''}>
              <svg className="auth-google-logo" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
                <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
              </svg>
              Continue with Google
            </button>
          </GlareHover>

          <div className="auth-divider">OR</div>

          {mode === 'register' && (
            <label className="auth-field">
              <span>{text.nameLabel}</span>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder={lang === 'id' ? 'Nama lo' : 'Your name'} required minLength={2} />
            </label>
          )}
          <label className="auth-field auth-field--email">
            <span className="auth-field-label auth-field-label--email">{text.emailLabel}</span>
            <input autoFocus={mode === 'login'} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={text.emailPlaceholder} required />
          </label>
          {email.trim() && (
            <label className="auth-field">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={text.passwordPlaceholder} required minLength={6} />
            </label>
          )}

          {error && <p className="auth-error">⚠️ {error}</p>}

          <GlareHover
            width="100%"
            height="48px"
            background="var(--auth-primary)"
            borderRadius="10px"
            borderColor="var(--auth-line)"
            glareColor="#ffffff"
            glareOpacity={0.3}
            glareAngle={-45}
            transitionDuration={600}
            style={{ marginTop: '12px' }}
          >
            <button type="submit" className="auth-submit" disabled={busy} style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', height: '100%', transition: 'transform .08s' }} onMouseDown={e => !busy && (e.currentTarget.style.transform='scale(0.97)')} onMouseUp={e => e.currentTarget.style.transform=''} onMouseLeave={e => e.currentTarget.style.transform=''}>
              {busy ? 'Sebentar…' : mode === 'login' ? 'Masuk →' : 'Bikin akun →'}
            </button>
          </GlareHover>
        </form>

        <p className="auth-switch">
          {isLogin
            ? <>{text.switchText} <button onClick={() => { setMode('register'); setError('') }}>{text.switchButton}</button></>
            : <>{text.switchText} <button onClick={() => { setMode('login'); setError('') }}>{text.switchButton}</button></>}
        </p>
      </div>
    </main>
  </div>
  )
}
