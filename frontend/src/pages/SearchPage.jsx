import { useState, useEffect, useRef, useMemo } from 'react'
import { ChatPanel } from '../components/ChatPanel'
import { apiUrl } from '../lib/api'
import logo from '../assets/logo.png'

function greetingWord(d = new Date()) {
  const h = d.getHours()
  if (h < 11) return 'pagi'
  if (h < 15) return 'siang'
  if (h < 18) return 'sore'
  return 'malam'
}

function buildGreetings(name) {
  return [
    `Selamat ${greetingWord()}, ${name}`,
    `Halo, ${name}`,
    `Apa kabar, ${name}`,
    `Mau ngerjain apa, ${name}`,
    `Siap ngebut, ${name}`,
    `Lagi sibuk apa, ${name}`,
  ]
}

function HeroGreeting({ name }) {
  const target = useMemo(() => {
    const pool = buildGreetings(name)
    return pool[Math.floor(Math.random() * pool.length)]
  }, [name])
  return (
    <h1 className="search-hero-heading">
      {target}
    </h1>
  )
}

const STORAGE_KEY = 'ys-search-chats-v1'

function genId() {
  return 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { conversations: [] }
    return JSON.parse(raw)
  } catch { return { conversations: [] } }
}

const CHIPS = [
  { icon: '📋', label: 'Task di board' },
  { icon: '⏰', label: 'Cek deadline' },
  { icon: '👥', label: 'Info tim' },
  { icon: '📊', label: 'Laporan absen' },
]

export function SearchPage({ userName = 'Anesh', newChatKey = 0, getBoardSummary, getAppContext, onToolCall }) {
  const [conversations, setConversations] = useState(() => loadChats().conversations || [])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [input, setInput] = useState('')
  const abortRef = useRef(null)
  const activeConvRef = useRef(null)
  const firstName = userName.split(' ')[0]

  useEffect(() => {
    setActiveId(null)
    setInput('')
  }, [newChatKey])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations }))
    } catch {}
  }, [conversations])

  const activeConv = conversations.find(c => c.id === activeId) || null
  activeConvRef.current = activeConv
  const messages = activeConv?.messages || []
  const hasMessages = messages.length > 0

  async function handleSend(text) {
    if (!text.trim() || loading) return

    let convId = activeId
    let existingHistory = []

    if (!activeId) {
      const newConv = {
        id: genId(),
        title: text.slice(0, 48),
        createdAt: Date.now(),
        messages: [],
        history: [],
      }
      convId = newConv.id
      setConversations(prev => [newConv, ...prev])
      setActiveId(convId)
    } else {
      existingHistory = activeConvRef.current?.history || []
    }

    const userMsg = { id: 'm' + Date.now(), role: 'user', content: text, ts: Date.now() }
    const assistantId = 'ma' + Date.now()
    const placeholder = { id: assistantId, role: 'assistant', content: '', streaming: true, ts: Date.now() }

    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, messages: [...c.messages, userMsg, placeholder] } : c
    ))
    setLoading(true)

    try {
      abortRef.current = new AbortController()
      const history = [...existingHistory, { role: 'user', content: text }]

      const res = await fetch(apiUrl('/api/chat/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: text,
          model: 'claude-haiku-4-5',
          user_id: 'search',
          chat_history: history.slice(-20),
          board_data: getBoardSummary ? { columns: getBoardSummary(), app: getAppContext ? getAppContext() : undefined } : {},
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw)
            if (event.type === 'tool' && onToolCall) {
              if (event.result?.action) onToolCall({ tool: event.result.action, ...event.result })
            } else if (event.type === 'token') {
              fullText += event.token
              setConversations(prev => prev.map(c =>
                c.id === convId
                  ? { ...c, messages: c.messages.map(m => m.id === assistantId ? { ...m, content: fullText } : m) }
                  : c
              ))
            } else if (event.type === 'done') {
              const finalText = event.full_text || fullText
              setConversations(prev => prev.map(c =>
                c.id === convId ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === assistantId ? { ...m, content: finalText, streaming: false } : m
                  ),
                  history: [...(c.history || []),
                    { role: 'user', content: text },
                    { role: 'assistant', content: finalText },
                  ],
                } : c
              ))
            } else if (event.type === 'error') {
              setConversations(prev => prev.map(c =>
                c.id === convId ? {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === assistantId ? { ...m, content: `⚠️ ${event.error}`, streaming: false } : m
                  ),
                } : c
              ))
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      const isNetwork = err.message === 'Failed to fetch' || err.name === 'TypeError'
      const msg = isNetwork
        ? '⚠️ Gak bisa nyambung ke server AI. Pastiin backend lagi jalan.'
        : `⚠️ Error: ${err.message}`
      setConversations(prev => prev.map(c =>
        c.id === convId ? {
          ...c,
          messages: c.messages.map(m =>
            m.id === assistantId ? { ...m, content: msg, streaming: false } : m
          ),
        } : c
      ))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function stopStream() {
    abortRef.current?.abort()
    setLoading(false)
    setConversations(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: c.messages.map(m => m.streaming ? { ...m, streaming: false } : m) }
        : c
    ))
  }

  function deleteConv(id, e) {
    e.stopPropagation()
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const chatPanel = (
    <ChatPanel
      hideHeader
      messages={messages}
      loading={loading}
      onSend={handleSend}
      stopStream={stopStream}
      model="claude-haiku-4-5"
      inputValue={input}
      onInputChange={setInput}
      clearOnSubmit
      placeholder="Tanya apa aja…"
    />
  )

  return (
    <div className="search-page-v2">

      {/* ── History panel (slide from right) ── */}
      {historyOpen && (
        <div className="search-history-backdrop" onClick={() => setHistoryOpen(false)} />
      )}
      <div className={`search-history-panel${historyOpen ? ' open' : ''}`}>
        <div className="search-history-head">
          <span className="search-history-title">History</span>
          <button className="search-history-close" onClick={() => setHistoryOpen(false)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <button className="search-new-chat-btn" onClick={() => { setActiveId(null); setInput(''); setHistoryOpen(false) }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Chat
        </button>
        <div className="search-conv-list">
          {conversations.length === 0 && (
            <p className="search-conv-empty">Belum ada riwayat</p>
          )}
          {conversations.map(c => (
            <div
              key={c.id}
              className={`search-conv-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => { setActiveId(c.id); setHistoryOpen(false) }}
            >
              <span className="search-conv-title">{c.title || 'Chat baru'}</span>
              <button className="search-conv-del" title="Hapus" onClick={e => deleteConv(c.id, e)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div className="search-main-v2">
        <div className="search-topbar-v2">
          <button className="search-history-btn" onClick={() => setHistoryOpen(v => !v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            History
          </button>
        </div>

        {!hasMessages ? (
          /* ── Empty: Claude-style centered hero ── */
          <div className="search-empty-wrap">
            <HeroGreeting key={newChatKey} name={firstName} />
            <div className="search-panel-host empty">{chatPanel}</div>
            <div className="search-chips">
              {CHIPS.map(c => (
                <button key={c.label} className="search-chip" onClick={() => setInput(c.label)}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Active conversation ── */
          <div className="search-panel-host active">{chatPanel}</div>
        )}
      </div>
    </div>
  )
}
