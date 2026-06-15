import { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import GlareHover from '../components/GlareHover'
import { SlotText } from 'slot-text/react'
import { chromatic } from 'slot-text'
import 'slot-text/style.css'

export function AuthPage({ theme, setTheme, onLogin, onRegister }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [lang, setLang] = useState('id') // 'id' | 'en'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // start from a scramble so each char visibly rolls into place on mount
  const [heroText, setHeroText] = useState('Yuor Sapce')

  useEffect(() => {
    const t = setTimeout(() => setHeroText('Your Space'), 160)
    return () => clearTimeout(t)
  }, [])

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
          <Logo className="auth-hero-logo" />
          <h1>
            <SlotText
              text={heroText}
              options={{ direction: 'up', color: chromatic({ from: 190 }), skipUnchanged: false }}
            />
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
            <button type="button" className="auth-google-btn" style={{ background: 'transparent', border: 'none', width: '100%', height: '100%' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/3840px-Google_%22G%22_logo.svg.png" alt="Google" className="auth-google-logo" />
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
            <button type="submit" className="auth-submit" disabled={busy} style={{ background: 'transparent', border: 'none', margin: 0, width: '100%', height: '100%' }}>
              <SlotText
                text={busy ? 'Sebentar…' : mode === 'login' ? 'Masuk →' : 'Bikin akun →'}
                options={{
                  direction: 'up',
                  duration: 120,
                  bounce: 0.2,
                  easing: 'cubic-bezier(0.3, 0, 0, 1)',
                  color: chromatic({ from: 190 }),
                  skipUnchanged: true,
                }}
              />
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
