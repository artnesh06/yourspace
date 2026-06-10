import { useRef, useEffect, useState } from 'react'
import { useModels } from '../hooks/useModels'

/* ── Model Picker ─────────────────────────────────────────────── */
function ModelPicker({ model, onSelect, onClose }) {
  const { groups, loading } = useModels()
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = groups.map(g => ({
    ...g,
    models: g.models.filter(m => m.toLowerCase().includes(search.toLowerCase())),
  })).filter(g => g.models.length > 0)

  function getProviderIcon(provider) {
    if (provider.includes('Llama') || provider.includes('Meta')) return '🦙'
    if (provider.includes('Google') || provider.includes('Gemma')) return '🔵'
    if (provider.includes('Mistral')) return '💨'
    if (provider.includes('DeepSeek')) return '🔍'
    if (provider.includes('Qwen')) return '🌐'
    return '⚡'
  }

  return (
    <div className="model-picker-overlay" onClick={onClose}>
      <div className="model-picker" onClick={e => e.stopPropagation()}>
        <div className="model-picker-search-wrap">
          <input
            ref={inputRef}
            className="model-picker-search"
            placeholder="Search models..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="model-picker-list">
          {loading && <div className="model-picker-loading">Loading models...</div>}
          {filtered.map(group => (
            <div key={group.provider}>
              <div className="model-group-header">
                <span className="model-group-icon">{getProviderIcon(group.provider)}</span>
                {group.provider}
                <span className="model-group-count">{group.models.length}</span>
              </div>
              {group.models.map(m => (
                <button
                  key={m}
                  className={`model-item ${m === model ? 'active' : ''}`}
                  onClick={() => { onSelect(m); onClose() }}
                >
                  <span className="model-item-name">{m}</span>
                  <span className="model-status-dot" />
                </button>
              ))}
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="model-picker-loading">No models found</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Tool event badge ─────────────────────────────────────────── */
function ToolBadge({ event }) {
  const label = {
    add_card: '+ Added card',
    move_card: '↔ Moved card',
    delete_card: '✕ Deleted card',
    get_board_status: '📋 Read board',
  }[event.tool] || `🔧 ${event.tool}`

  return <span className="tool-badge">{label}</span>
}

/* ── Single message ───────────────────────────────────────────── */
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`chat-msg ${isUser ? 'chat-msg--user' : 'chat-msg--assistant'}`}>
      <div className="chat-msg-bubble">
        {/* Tool events */}
        {!isUser && msg.toolEvents?.length > 0 && (
          <div className="chat-tool-events">
            {msg.toolEvents.map((ev, i) => <ToolBadge key={i} event={ev} />)}
          </div>
        )}

        {/* Content */}
        {msg.content
          ? msg.content.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))
          : msg.streaming
            ? null
            : <span className="chat-empty">…</span>
        }

        {/* Cursor when streaming */}
        {msg.streaming && <span className="chat-cursor" />}

        {/* Metadata */}
        {!isUser && !msg.streaming && msg.tokens && (
          <div className="chat-msg-meta">
            {msg.tokens.input + msg.tokens.output} tok · {msg.elapsed}s
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main ChatPanel ───────────────────────────────────────────── */
export function ChatPanel({ messages, loading, onSend, stopStream, onClose, model, onModelChange }) {
  const [input, setInput]         = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    onSend(input.trim())
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
  }

  function handleInput(e) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  // Short display name for model button
  const modelShort = model.length > 22 ? model.slice(0, 20) + '…' : model

  const isFirstMessage = messages.length <= 1

  // Token usage calculation
  const MODEL_LIMITS = {
    'llama-3.3-70b-versatile': 128000,
    'llama-3.1-70b-versatile': 128000,
    'llama-3.1-8b-instant': 128000,
    'llama3-70b-8192': 8192,
    'llama3-8b-8192': 8192,
    'mixtral-8x7b-32768': 32768,
    'gemma2-9b-it': 8192,
    'gemma-7b-it': 8192,
    'deepseek-r1-distill-llama-70b': 128000,
    'qwen-qwq-32b': 128000,
  }
  const contextLimit = MODEL_LIMITS[model] || 32000
  const lastDone = [...messages].reverse().find(m => m.tokens?.input != null)
  const totalTokens = lastDone ? (lastDone.tokens.input + lastDone.tokens.output) : 0
  const tokenPct = Math.min(100, Math.round((totalTokens / contextLimit) * 100))
  const tokenClass = tokenPct < 50 ? 'low' : tokenPct < 80 ? 'medium' : 'high'

  return (
    <div className="chat-panel-inner">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-header-title">Chat</span>
          <span className="chat-header-badge">AI</span>
        </div>
        <div className="chat-header-actions">
          <button className="chat-header-btn" title="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {isFirstMessage && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">✦</div>
            <h3 className="chat-welcome-title">What do you want to build?</h3>
            <p className="chat-welcome-sub">Describe your agent or start with a template.</p>
            <div className="chat-suggestions">
              {['Summarize board progress', 'Explain board organization structure', 'List upcoming project deadlines'].map(s => (
                <button key={s} className="chat-suggestion" onClick={() => onSend(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}

        {loading && messages[messages.length - 1]?.streaming === false && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-msg-bubble">
              <span className="chat-typing"><span /><span /><span /></span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {/* Token usage bar */}
        {totalTokens > 0 && (
          <div className="chat-token-bar-wrap">
            <div className="chat-token-bar-row">
              <span className="chat-token-bar-label">{totalTokens.toLocaleString()} / {contextLimit.toLocaleString()} tok</span>
              <span className="chat-token-bar-pct" style={{ color: tokenPct >= 80 ? 'var(--pink-text)' : tokenPct >= 50 ? 'var(--yellow-text)' : 'var(--green-text)' }}>
                {tokenPct}%
              </span>
            </div>
            <div className="chat-token-bar">
              <div className={`chat-token-bar-fill ${tokenClass}`} style={{ width: `${tokenPct}%` }} />
            </div>
          </div>
        )}

        {/* Model selector row */}
        <div className="chat-model-row">
          <button className="chat-model-btn" onClick={() => setPickerOpen(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
            {modelShort}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Describe your agent..."
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            rows={1}
            disabled={false}
          />
          {loading
            ? <button type="button" className="chat-stop-btn" onClick={stopStream} title="Stop">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
            : <button type="submit" className="chat-send-btn" disabled={!input.trim()} aria-label="Send">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
          }
        </form>
      </div>

      {/* Model picker dropdown */}
      {pickerOpen && (
        <ModelPicker
          model={model}
          onSelect={onModelChange}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
