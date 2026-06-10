import { useRef, useEffect, useState } from 'react'
import { useModels } from '../hooks/useModels'

/* ── Claude starburst logo ────────────────────────────────────── */
function ClaudeStar({ size = 26, className = '' }) {
  const rays = []
  const COUNT = 11
  for (let i = 0; i < COUNT; i++) {
    const angle = (i * 360) / COUNT - 90 + (i % 2 ? 5 : 0)
    const len = i % 3 === 0 ? 9.6 : i % 3 === 1 ? 8.2 : 8.9
    const rad = (angle * Math.PI) / 180
    rays.push(
      <line
        key={i}
        x1={12 + Math.cos(rad) * 2.4}
        y1={12 + Math.sin(rad) * 2.4}
        x2={12 + Math.cos(rad) * len}
        y2={12 + Math.sin(rad) * len}
        stroke="#D97757"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    )
  }
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {rays}
    </svg>
  )
}

/* ── Streaming text: Claude-style word fade-in ────────────────── */
function StreamingText({ text }) {
  const parts = text.split(/(\s+)/)
  return (
    <span className="chat-streaming-text">
      {parts.map((part, i) =>
        part.trim()
          ? <span key={i} className="stream-word">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

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

/* ── Simple Markdown Renderer ─────────────────────────────────── */
function renderMarkdown(text) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Empty line
    if (!line.trim()) {
      elements.push(<br key={i} />)
      i++
      continue
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="md-h3">{parseInline(line.slice(4))}</h4>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="md-h2">{parseInline(line.slice(3))}</h3>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="md-h1">{parseInline(line.slice(2))}</h2>)
      i++; continue
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      elements.push(<hr key={i} className="md-hr" />)
      i++; continue
    }

    // Unordered list
    if (line.match(/^[-*+] /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(<li key={i}>{parseInline(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} className="md-ul">{items}</ul>)
      continue
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} className="md-ol">{items}</ol>)
      continue
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(<pre key={i} className="md-pre"><code>{codeLines.join('\n')}</code></pre>)
      i++; continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} className="md-blockquote">{parseInline(line.slice(2))}</blockquote>)
      i++; continue
    }

    // Regular paragraph
    elements.push(<p key={i} className="md-p">{parseInline(line)}</p>)
    i++
  }

  return elements
}

function parseInline(text) {
  if (!text) return ''

  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold + Italic ***text***
    const boldItalicMatch = remaining.match(/^(.*?)\*\*\*(.*?)\*\*\*/)
    if (boldItalicMatch) {
      if (boldItalicMatch[1]) parts.push(<span key={key++}>{parseInline(boldItalicMatch[1])}</span>)
      parts.push(<strong key={key++}><em>{boldItalicMatch[2]}</em></strong>)
      remaining = remaining.slice(boldItalicMatch[0].length)
      continue
    }

    // Bold **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*/)
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>)
      parts.push(<strong key={key++}>{boldMatch[2]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic *text*
    const italicMatch = remaining.match(/^(.*?)\*(.*?)\*/)
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>)
      parts.push(<em key={key++}>{italicMatch[2]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Inline code `code`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/)
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>)
      parts.push(<code key={key++} className="md-code">{codeMatch[2]}</code>)
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
    if (linkMatch) {
      if (linkMatch[1]) parts.push(<span key={key++}>{linkMatch[1]}</span>)
      parts.push(<a key={key++} href={linkMatch[3]} target="_blank" rel="noopener noreferrer" className="md-link">{linkMatch[2]}</a>)
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // Auto-link https://...
    const autoLinkMatch = remaining.match(/^(.*?)(https?:\/\/[^\s]+)/)
    if (autoLinkMatch) {
      if (autoLinkMatch[1]) parts.push(<span key={key++}>{autoLinkMatch[1]}</span>)
      parts.push(<a key={key++} href={autoLinkMatch[2]} target="_blank" rel="noopener noreferrer" className="md-link">{autoLinkMatch[2]}</a>)
      remaining = remaining.slice(autoLinkMatch[0].length)
      continue
    }

    // No more patterns — output rest as text
    parts.push(<span key={key++}>{remaining}</span>)
    break
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

function ToolBadge({ event }) {
  const label = {
    add_card: '+ Added card',
    move_card: '↔ Moved card',
    delete_card: '✕ Deleted card',
    get_board_status: '📋 Read board',
  }[event.tool] || `🔧 ${event.tool}`

  return <span className="tool-badge">{label}</span>
}

/* ── Action icons under assistant message (Claude style) ──────── */
function MessageActions({ msg, onRetry }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard?.writeText(msg.content || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="chat-msg-actions">
      <button className="chat-action-btn" title="Copy" onClick={handleCopy}>
        {copied
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        }
      </button>
      <button className="chat-action-btn" title="Read aloud">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
      </button>
      <button className="chat-action-btn" title="Good response">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button className="chat-action-btn" title="Bad response">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
      </button>
      <button className="chat-action-btn" title="Retry" onClick={() => onRetry?.(msg.id)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      </button>
    </div>
  )
}

/* ── Single message ───────────────────────────────────────────── */
function ChatMessage({ msg, onRetry }) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="chat-msg chat-msg--user">
        <div className="chat-msg-bubble">{msg.content}</div>
      </div>
    )
  }

  return (
    <div className="chat-msg chat-msg--assistant">
      <div className="chat-msg-body">
        {/* Tool events */}
        {msg.toolEvents?.length > 0 && (
          <div className="chat-tool-events">
            {msg.toolEvents.map((ev, i) => <ToolBadge key={i} event={ev} />)}
          </div>
        )}

        {/* Content */}
        {msg.streaming
          ? (msg.content
              ? <div className="chat-assistant-text"><StreamingText text={msg.content} /></div>
              : <ClaudeStar size={28} className="claude-star claude-star--loading" />)
          : (msg.content
              ? <div className="chat-assistant-text md-content">{renderMarkdown(msg.content)}</div>
              : <span className="chat-empty">…</span>)
        }

        {/* Action icons (Claude style) */}
        {!msg.streaming && msg.content && <MessageActions msg={msg} onRetry={onRetry} />}
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

  function handleRetry(msgId) {
    if (loading) return
    const idx = messages.findIndex(m => m.id === msgId)
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { onSend(messages[i].content); return }
    }
  }

  // Short display name for model button
  const modelShort = model.length > 22 ? model.slice(0, 20) + '…' : model

  const lastMsg = messages[messages.length - 1]

  return (
    <div className="chat-panel-inner">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left" />
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
        {messages.map(msg => <ChatMessage key={msg.id} msg={msg} onRetry={handleRetry} />)}

        {loading && lastMsg?.streaming === false && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-msg-body">
              <ClaudeStar size={28} className="claude-star claude-star--loading" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area (Claude style) */}
      <div className="chat-input-area">
        <form className="chat-input-box" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Tulis pesan…"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            rows={1}
          />
          <div className="chat-input-controls">
            <button type="button" className="chat-icon-btn" title="Add">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <div className="chat-input-right">
              <button type="button" className="chat-model-btn" onClick={() => setPickerOpen(true)}>
                {modelShort}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {loading ? (
                <button type="button" className="chat-stop-btn" onClick={stopStream} title="Stop">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg>
                </button>
              ) : input.trim() ? (
                <button type="submit" className="chat-send-btn" aria-label="Send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                  </svg>
                </button>
              ) : (
                <>
                  <button type="button" className="chat-icon-btn" title="Voice input">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                    </svg>
                  </button>
                  <button type="button" className="chat-icon-btn" title="Voice mode">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <line x1="4" y1="10" x2="4" y2="14"/><line x1="8" y1="7" x2="8" y2="17"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="16" y1="7" x2="16" y2="17"/><line x1="20" y1="10" x2="20" y2="14"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
        <div className="chat-disclaimer">Claude adalah AI dan bisa keliru. Harap periksa kembali respons.</div>
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
