import { useState } from 'react'
import Lanyard from '../components/Lanyard'
import './ProfilePage.css'

// ── App theme: Light / Dark only ──
const APP_THEMES = [
  { id: 'light', label: 'Light', preview: ['#FFFFFF', '#FAF9F5', '#FAF9F5', '#FFFFFF'] },
  { id: 'dark',  label: 'Dark',  preview: ['#0B1013', '#0B1013', '#E8E8E8', '#FFFFFF'] },
]

// ── Board background ──
const BOARD_BGS = [
  { id: 'default',  label: 'Default',  bg: null },
  { id: 'blue',     label: 'Ocean',    bg: 'linear-gradient(315deg, #4F98FA 0%, #2D72D8 80%)' },
  { id: 'navy',     label: 'Navy',     bg: 'linear-gradient(315deg, #6b7fc0 0%, #2e3f72 80%)' },
  { id: 'purple',   label: 'Purple',   bg: 'linear-gradient(315deg, #c08cff 0%, #7c3aed 80%)' },
  { id: 'teal',     label: 'Teal',     bg: 'linear-gradient(315deg, #5eead4 0%, #14b8a6 80%)' },
  { id: 'sunset',   label: 'Sunset',   bg: 'linear-gradient(315deg, #fdba74 0%, #f43f8e 80%)' },
  { id: 'rose',     label: 'Rose',     bg: 'linear-gradient(315deg, #fecdd3 0%, #fb5475 80%)' },
  { id: 'slate',    label: 'Slate',    bg: 'linear-gradient(315deg, #94a3b8 0%, #475569 80%)' },
  { id: 'forest',   label: 'Forest',   bg: 'linear-gradient(315deg, #4ade80 0%, #16a34a 80%)' },
]

// ── Column & card: White / Black ──
const COL_THEMES = [
  { id: 'default', label: 'White', col: '#FAF9F5', card: '#FFFFFF', colLine: '#E8E6DD' },
  { id: 'dark',    label: 'Black', col: '#1A2228', card: '#222C34', colLine: '#2F3942' },
]

function applyBoardBg(t) {
  const root = document.documentElement
  if (t.id === 'default' || !t.bg) {
    root.removeAttribute('data-board-bg')
    root.style.removeProperty('--board-bg')
  } else {
    root.style.setProperty('--board-bg', t.bg)
    root.setAttribute('data-board-bg', t.id)
  }
}

function applyColTheme(t) {
  const root = document.documentElement
  root.style.setProperty('--custom-col-bg', t.col)
  root.style.setProperty('--custom-card-bg', t.card)
  root.style.setProperty('--custom-col-line', t.colLine)
  if (t.id === 'default') root.removeAttribute('data-custom-col')
  else root.setAttribute('data-custom-col', t.id)
}

// Apply saved settings on load
;(() => {
  const boardId = localStorage.getItem('board-bg')
  const colId = localStorage.getItem('col-theme')
  if (boardId) { const t = BOARD_BGS.find(x => x.id === boardId); if (t) applyBoardBg(t) }
  if (colId)   { const t = COL_THEMES.find(x => x.id === colId);  if (t) applyColTheme(t) }
})()

export function ProfilePage({ user, theme, setTheme }) {
  const [boardBg, setBoardBg] = useState(() => localStorage.getItem('board-bg') || 'default')
  const [colTheme, setColTheme] = useState(() => localStorage.getItem('col-theme') || 'default')

  // current effective app theme (light/dark, resolving "system")
  const effectiveTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'

  function selectBoardBg(t) {
    setBoardBg(t.id); applyBoardBg(t); localStorage.setItem('board-bg', t.id)
  }
  function selectColTheme(t) {
    setColTheme(t.id); applyColTheme(t); localStorage.setItem('col-theme', t.id)
  }

  return (
    <div className="profile-page">
      <div className="profile-lanyard">
        <Lanyard position={[0, 0, 18]} gravity={[0, -30, 0]} fov={25} />
      </div>

      <div className="profile-body">
        <div className="profile-info">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || '?'}</div>
          <div>
            <div className="profile-name">{user?.name || 'User'}</div>
            <div className="profile-email">{user?.email || ''}</div>
          </div>
        </div>

        {/* App theme */}
        <div className="profile-section">
          <div className="profile-section-label">Tema</div>
          <div className="theme-cards">
            {APP_THEMES.map(t => (
              <ThemeCard
                key={t.id}
                preview={t.preview}
                label={t.label}
                active={effectiveTheme === t.id}
                onClick={() => setTheme?.(t.id)}
              />
            ))}
          </div>
        </div>

        {/* Board background */}
        <div className="profile-section">
          <div className="profile-section-label">Background Board</div>
          <div className="theme-grid">
            {BOARD_BGS.map(t => (
              <button
                key={t.id}
                className={`theme-swatch ${boardBg === t.id ? 'active' : ''}`}
                style={{ background: t.bg || 'var(--surface)', border: boardBg === t.id ? '2px solid var(--accent)' : '2px solid rgba(0,0,0,0.1)' }}
                title={t.label}
                onClick={() => selectBoardBg(t)}
              >
                {t.id === 'default' && (
                  <span className="swatch-x">{boardBg === t.id ? '✓' : '—'}</span>
                )}
                {boardBg === t.id && t.id !== 'default' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Column & card */}
        <div className="profile-section">
          <div className="profile-section-label">Kolom & Card</div>
          <div className="theme-cards">
            {COL_THEMES.map(t => (
              <ThemeCard
                key={t.id}
                preview={['#E8E8E8', '#E8E8E8', t.col, t.card]}
                label={t.label}
                active={colTheme === t.id}
                onClick={() => selectColTheme(t)}
                colMode
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeCard({ preview, label, active, onClick, colMode }) {
  return (
    <button className={`theme-card ${active ? 'active' : ''}`} onClick={onClick} title={label}>
      <div className="theme-card-preview">
        {!colMode && <div className="tcp-sidebar" style={{ background: preview[0] }} />}
        <div className="tcp-board" style={{ background: preview[1] }}>
          <div className="tcp-col" style={{ background: preview[2] }}>
            <div className="tcp-card" style={{ background: preview[3] }} />
            <div className="tcp-card" style={{ background: preview[3], opacity: 0.7 }} />
          </div>
        </div>
      </div>
      <span className="theme-card-label">{label}</span>
      {active && <div className="theme-card-check">✓</div>}
    </button>
  )
}
