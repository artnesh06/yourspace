import { useState, useMemo } from 'react'

function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function ClaudeStar({ size = 34 }) {
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

function highlight(text, q) {
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-mark">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

const CHIPS = [
  { icon: '🔍', label: 'Cari card', q: '' },
  { icon: '📅', label: 'Deadline', q: 'Apr' },
  { icon: '🎨', label: 'Konten', q: 'konten' },
  { icon: '🤝', label: 'Kolaborasi', q: 'kolaborasi' },
]

export function SearchPage({ boards, userName = 'Anesh', onOpenCard, onAskAI }) {
  const [q, setQ] = useState('')
  const hasQuery = q.trim().length > 0

  function askAI() {
    if (!q.trim()) return
    onAskAI?.(q.trim())
    setQ('')
  }

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    const out = []
    for (const b of boards) {
      for (const col of b.columns) {
        for (const card of col.cards) {
          const inTitle = card.title.toLowerCase().includes(query)
          const inDesc = (card.description || '').toLowerCase().includes(query)
          if (inTitle || inDesc) out.push({ board: b, column: col, card })
        }
      }
    }
    return out
  }, [q, boards])

  return (
    <div className="page-frame">
      <div className={`page-scroll claude-search ${hasQuery ? 'searching' : ''}`}>

        <div className="claude-hero">
          <h1 className="claude-greeting">
            <ClaudeStar />
            {greeting()}, {userName.split(' ')[0]}
          </h1>
        </div>

        <div className="claude-input-card">
          <input
            autoFocus
            className="claude-input"
            placeholder="Cari card, atau tanya AI apa aja…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setQ('')
              if (e.key === 'Enter') askAI()
            }}
          />
          <div className="claude-input-foot">
            <span className="claude-plus">+</span>
            <span className="claude-model">
              {hasQuery
                ? <button className="claude-ask-btn" onClick={askAI}>✦ Tanya AI <kbd>↵</kbd></button>
                : 'Search semua board · Enter = tanya AI'}
              {hasQuery && <button className="search-clear" onClick={() => setQ('')}>×</button>}
            </span>
          </div>
        </div>

        {!hasQuery && (
          <div className="claude-chips">
            {CHIPS.map(c => (
              <button key={c.label} className="claude-chip" onClick={() => c.q && setQ(c.q)}>
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        )}

        {hasQuery && (
          <div className="claude-results">
            <p className="search-count">
              {results.length === 0 ? 'Nggak ketemu apa-apa 😅' : `${results.length} hasil ditemukan`}
            </p>
            <div className="search-results">
              {results.map(({ board, column, card }, i) => (
                <button
                  key={card.id}
                  className="search-result anim-in"
                  style={{ animationDelay: `${i * 45}ms` }}
                  onClick={() => onOpenCard(board.id, card)}
                >
                  <div className="search-result-top">
                    <span className="search-result-title">{highlight(card.title, q.trim())}</span>
                    {card.posted && <span className="search-result-done">✓ Done</span>}
                  </div>
                  {card.description && (
                    <p className="search-result-desc">{highlight(card.description, q.trim())}</p>
                  )}
                  <div className="search-result-meta">
                    <span className="search-result-chip">🌿 {board.label}</span>
                    <span className="search-result-chip">{column.title}</span>
                    {card.due && <span className="search-result-chip">📅 {card.due}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
