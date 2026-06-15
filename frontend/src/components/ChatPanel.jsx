import { useRef, useEffect, useState } from 'react'
import chatLoadingGif from '../assets/chat-loading.gif'
import { useModels } from '../hooks/useModels'
import { uploadFile } from '../lib/api'

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

/* ── Streaming text: markdown-aware, word fade-in (Claude style) ──
   Renders **bold** / *italic* / `code` live — even before the closing
   marker arrives — so the user never sees raw `**` while streaming.    */
function tokenizeInline(text) {
  const runs = []
  let rem = text
  let guard = 0
  while (rem.length && guard++ < 8000) {
    let m
    if ((m = rem.match(/^\*\*\*([^]+?)\*\*\*/))) { runs.push({ t: m[1], b: true, i: true }); rem = rem.slice(m[0].length); continue }
    if ((m = rem.match(/^\*\*([^]+?)\*\*/)))     { runs.push({ t: m[1], b: true });         rem = rem.slice(m[0].length); continue }
    if ((m = rem.match(/^`([^`]+)`/)))           { runs.push({ t: m[1], code: true });      rem = rem.slice(m[0].length); continue }
    if ((m = rem.match(/^\*([^*]+?)\*/)))        { runs.push({ t: m[1], i: true });         rem = rem.slice(m[0].length); continue }
    // unclosed markers while streaming → format the remainder, drop the markers
    if (rem.startsWith('***')) { runs.push({ t: rem.slice(3), b: true, i: true }); break }
    if (rem.startsWith('**'))  { runs.push({ t: rem.slice(2), b: true }); break }
    if (rem.startsWith('`'))   { runs.push({ t: rem.slice(1), code: true }); break }
    if (rem.startsWith('*'))   { runs.push({ t: rem.slice(1), i: true }); break }
    // plain run until the next marker
    const next = rem.slice(1).search(/[*`]/)
    if (next === -1) { runs.push({ t: rem }); break }
    runs.push({ t: rem.slice(0, next + 1) }); rem = rem.slice(next + 1)
  }
  return runs
}

// Stable keys (counter is append-only) so only NEW words animate, not the whole block.
function runsToWords(runs, counter) {
  const out = []
  for (const run of runs) {
    for (const piece of run.t.split(/(\s+)/)) {
      if (piece === '') continue
      if (!piece.trim()) { out.push(<span key={'s' + counter.n++}>{piece}</span>); continue }
      let node = piece
      if (run.code) node = <code className="md-code">{node}</code>
      if (run.i)    node = <em>{node}</em>
      if (run.b)    node = <strong>{node}</strong>
      out.push(<span key={'w' + counter.n++} className="stream-word">{node}</span>)
    }
  }
  return out
}

function StreamingText({ text }) {
  const counter = { n: 0 }
  const lines = text.split('\n')
  const blocks = []
  let li = 0
  while (li < lines.length) {
    const line = lines[li]
    if (!line.trim()) { li++; continue }
    if (/^[-*+] /.test(line)) {
      const items = []
      while (li < lines.length && /^[-*+] /.test(lines[li])) {
        items.push(<li key={li}>{runsToWords(tokenizeInline(lines[li].slice(2)), counter)}</li>); li++
      }
      blocks.push(<ul key={'ul' + li} className="md-ul">{items}</ul>); continue
    }
    if (/^\d+\. /.test(line)) {
      const items = []
      while (li < lines.length && /^\d+\. /.test(lines[li])) {
        items.push(<li key={li}>{runsToWords(tokenizeInline(lines[li].replace(/^\d+\. /, '')), counter)}</li>); li++
      }
      blocks.push(<ol key={'ol' + li} className="md-ol">{items}</ol>); continue
    }
    if (line.startsWith('### ')) { blocks.push(<h4 key={li} className="md-h3">{runsToWords(tokenizeInline(line.slice(4)), counter)}</h4>); li++; continue }
    if (line.startsWith('## '))  { blocks.push(<h3 key={li} className="md-h2">{runsToWords(tokenizeInline(line.slice(3)), counter)}</h3>); li++; continue }
    if (line.startsWith('# '))   { blocks.push(<h2 key={li} className="md-h1">{runsToWords(tokenizeInline(line.slice(2)), counter)}</h2>); li++; continue }
    blocks.push(<p key={li} className="md-p">{runsToWords(tokenizeInline(line), counter)}</p>); li++
  }
  return <div className="chat-streaming-text md-content">{blocks}</div>
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

    // Empty line — skip; .md-content flex gap handles block spacing
    if (!line.trim()) {
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
    update_card: '✎ Updated card',
    move_card: '↔ Moved card',
    delete_card: '✕ Deleted card',
    duplicate_card: '⧉ Duplicated card',
    open_card: '↗ Opened card',
    add_column: '+ Added column',
    rename_column: '✎ Renamed column',
    delete_column: '✕ Deleted column',
    add_comment: '💬 Added comment',
    add_checklist_item: '☑ Added checklist item',
    toggle_checklist_item: '☑ Toggled checklist',
    add_team_member: '+ Added member',
    update_team_member: '✎ Updated member',
    remove_team_member: '✕ Removed member',
    delete_attendance_record: '✕ Deleted absen',
    clock_in: '🟢 Clock in',
    clock_out: '🔴 Clock out',
    navigate_page: '🧭 Navigated',
    save_memory: '🧠 Saved memory',
    get_board_status: '📋 Read board',
  }[event.tool] || `🔧 ${event.tool}`

  return <span className="tool-badge">{label}</span>
}

/* ── Action icons under assistant message (Claude style) ──────── */
function MessageActions({ msg, onRetry }) {
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'up' | 'down' | null

  function handleCopy() {
    navigator.clipboard?.writeText(msg.content || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleSpeak() {
    const synth = window.speechSynthesis
    if (!synth) return
    if (speaking) { synth.cancel(); setSpeaking(false); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(msg.content || '')
    u.lang = 'id-ID'
    const idVoice = synth.getVoices().find(v => v.lang?.startsWith('id'))
    if (idVoice) u.voice = idVoice
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(u)
  }

  // stop speaking if the component unmounts
  useEffect(() => () => { if (speaking) window.speechSynthesis?.cancel() }, [speaking])

  function handleFeedback(val) {
    setFeedback(prev => (prev === val ? null : val))
  }

  return (
    <div className="chat-msg-actions">
      <button className="chat-action-btn" title="Copy" onClick={handleCopy}>
        {copied
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        }
      </button>
      <button className={`chat-action-btn ${speaking ? 'active' : ''}`} title={speaking ? 'Stop' : 'Read aloud'} onClick={handleSpeak}>
        {speaking
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
        }
      </button>
      <button className={`chat-action-btn ${feedback === 'up' ? 'active' : ''}`} title="Good response" onClick={() => handleFeedback('up')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={feedback === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button className={`chat-action-btn ${feedback === 'down' ? 'active' : ''}`} title="Bad response" onClick={() => handleFeedback('down')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={feedback === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
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
        <div className="chat-msg-bubble">
          {msg.image && <img className="chat-msg-image" src={msg.image} alt="lampiran" />}
          {msg.content && <span>{msg.content}</span>}
        </div>
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
              : <div className="chat-thinking">
                  <img src={chatLoadingGif} alt="" className="chat-loading-gif" />
                  <span className="chat-thinking-text">{msg.thinkingLabel || 'AI lagi mikir'}<span className="chat-thinking-dots" /></span>
                </div>)
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
export function ChatPanel({
  messages,
  loading,
  onSend,
  stopStream,
  onClose,
  model,
  onModelChange,
  title = 'AI Chat',
  hideHeader = false,
  inputValue,
  onInputChange,
  clearOnSubmit = true,
  placeholder = 'Tulis pesan…',
}) {
  const [input, setInput]         = useState('')
  const [pendingImage, setPendingImage] = useState(null) // { url, name }
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handlePickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset biar bisa pilih file sama lagi
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadFile(file)
      setPendingImage({ url, name: file.name })
    } catch (err) {
      alert('Gagal upload gambar: ' + (err?.message || 'unknown'))
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    // Controlled mode (Search) menaruh teks di `inputValue`, bukan state internal.
    // Pakai nilai efektif biar submit/Enter jalan di kedua mode.
    const text = typeof inputValue === 'string' ? inputValue : input
    if ((!text.trim() && !pendingImage) || loading) return
    onSend(text.trim(), pendingImage?.url || null)
    if (clearOnSubmit) {
      if (onInputChange) onInputChange('')
      else setInput('')
    }
    setPendingImage(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
  }

  function handleInput(e) {
    if (onInputChange) onInputChange(e.target.value)
    else setInput(e.target.value)
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

  const lastMsg = messages[messages.length - 1]
  const currentInput = typeof inputValue === 'string' ? inputValue : input

  return (
    <div className="chat-panel-inner">
      {/* Header */}
      {!hideHeader && (
        <div className="chat-header">
          <div className="chat-header-left">
            <span className="chat-header-title">{title}</span>
            <span className="chat-header-badge">{model}</span>
          </div>
          <div className="chat-header-actions">
            {onClose && (
              <button className="chat-header-btn" title="Close" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map(msg => <ChatMessage key={msg.id} msg={msg} onRetry={handleRetry} />)}

        {loading && lastMsg?.streaming === false && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-msg-body">
              <img src={chatLoadingGif} alt="loading" className="chat-loading-gif" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area (Claude style) */}
      <div className="chat-input-area">
        <form className="chat-input-box" onSubmit={handleSubmit}>
          {/* Preview gambar yang dilampirkan */}
          {pendingImage && (
            <div className="chat-attach-preview">
              <img src={pendingImage.url} alt={pendingImage.name} />
              <button type="button" className="chat-attach-remove" title="Hapus lampiran" onClick={() => setPendingImage(null)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={placeholder}
            value={currentInput}
            onChange={handleInput}
            onKeyDown={handleKey}
            rows={1}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePickImage}
          />
          <div className="chat-input-controls">
            <button
              type="button"
              className={`chat-icon-btn ${uploading ? 'active' : ''}`}
              title={uploading ? 'Mengupload…' : 'Lampirkan gambar'}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <div className="chat-input-right">
              {loading ? (
                <button type="button" className="chat-stop-btn" onClick={stopStream} title="Stop">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg>
                </button>
              ) : (currentInput.trim() || pendingImage) ? (
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
        <div className="chat-disclaimer">Verifikasi respons AI sebelum menggunakannya.</div>
      </div>
    </div>
  )
}
