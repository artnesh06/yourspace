import { useState, useEffect, useRef } from 'react'

const USER_NAME = 'Anesh'
const USER_INITIAL = 'A'

const LABEL_COLORS = ['pink', 'green', 'blue', 'yellow', 'purple']

function genImgId() {
  return 'img-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

/* Tiny inline renderer for description preview: **bold**, *italic*, `code`, links */
function renderInline(text, keyBase = 0) {
  const parts = []
  let remaining = text
  let key = keyBase

  while (remaining.length > 0) {
    const bold = remaining.match(/^(.*?)\*\*(.+?)\*\*/)
    if (bold) {
      if (bold[1]) parts.push(<span key={key++}>{bold[1]}</span>)
      parts.push(<strong key={key++}>{bold[2]}</strong>)
      remaining = remaining.slice(bold[0].length)
      continue
    }
    const italic = remaining.match(/^(.*?)\*(.+?)\*/)
    if (italic) {
      if (italic[1]) parts.push(<span key={key++}>{italic[1]}</span>)
      parts.push(<em key={key++}>{italic[2]}</em>)
      remaining = remaining.slice(italic[0].length)
      continue
    }
    const code = remaining.match(/^(.*?)`([^`]+)`/)
    if (code) {
      if (code[1]) parts.push(<span key={key++}>{code[1]}</span>)
      parts.push(<code key={key++} className="md-code">{code[2]}</code>)
      remaining = remaining.slice(code[0].length)
      continue
    }
    const link = remaining.match(/^(.*?)\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
    if (link) {
      if (link[1]) parts.push(<span key={key++}>{link[1]}</span>)
      parts.push(<a key={key++} href={link[3]} target="_blank" rel="noopener noreferrer" className="tm-link">{link[2]}</a>)
      remaining = remaining.slice(link[0].length)
      continue
    }
    parts.push(<span key={key++}>{remaining}</span>)
    break
  }
  return parts
}

function renderDescription(text) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <br key={i} />
    if (line.match(/^[-*+] /)) {
      return <div key={i} className="tm-desc-li">• {renderInline(line.slice(2), i * 100)}</div>
    }
    return <p key={i}>{renderInline(line, i * 100)}</p>
  })
}

function relTime(iso) {
  if (!iso) return 'just now'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

/* ── Toolbar icon button ── */
function TbBtn({ title, onClick, children, disabled }) {
  return (
    <button type="button" className="tm-tb-btn" title={title} disabled={disabled}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  )
}

export function CardModal({
  card, columnTitle, colIndex, allColumns,
  onClose, onUpdate, onDelete, onAddComment, onDeleteComment, onMove, onDuplicate,
}) {
  const [title, setTitle]             = useState(card.title)
  const [description, setDesc]        = useState(card.description || '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [due, setDue]                 = useState(card.due || '')
  const [commentText, setComment]     = useState('')
  const [images, setImages]           = useState(card.images || [])
  const [coverId, setCoverId]         = useState(card.coverId || null)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [datesOpen, setDatesOpen]     = useState(false)
  const [labelsOpen, setLabelsOpen]   = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editCommentText, setEditCommentText]   = useState('')
  const [isDragOver, setIsDragOver]   = useState(false)

  const overlayRef = useRef(null)
  const fileImgRef = useRef(null)
  const descRef    = useRef(null)
  const skipPersistImages = useRef(true)

  const currentColId = allColumns.find(col => col.cards?.find(c => c.id === card.id))?.id
  const cover = images.find(i => i.id === coverId)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    skipPersistImages.current = true
    setTitle(card.title); setDesc(card.description || ''); setDue(card.due || '')
    setImages(card.images || []); setCoverId(card.coverId || null)
    setEditingDesc(false); setMenuOpen(false); setColMenuOpen(false)
    setDatesOpen(false); setLabelsOpen(false); setEditingCommentId(null)
  }, [card.id])

  // Attachments persist immediately (Trello-style autosave)
  useEffect(() => {
    if (skipPersistImages.current) { skipPersistImages.current = false; return }
    onUpdate(card.id, { images, coverId })
  }, [images, coverId])

  function commitTitle() {
    const t = title.trim()
    if (!t) { setTitle(card.title); return }
    if (t !== card.title) onUpdate(card.id, { title: t })
  }

  function saveDesc() {
    onUpdate(card.id, { description })
    setEditingDesc(false)
  }
  function cancelDesc() {
    setDesc(card.description || '')
    setEditingDesc(false)
  }

  /* toolbar: wrap textarea selection with markdown markers */
  function wrapSelection(before, after = before) {
    const ta = descRef.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const next = description.slice(0, s) + before + description.slice(s, e) + after + description.slice(e)
    setDesc(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + before.length, e + before.length)
    })
  }
  function prefixLines(prefix) {
    const ta = descRef.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const lineStart = description.lastIndexOf('\n', s - 1) + 1
    const segment = description.slice(lineStart, e)
    const prefixed = segment.split('\n').map(l => (l.startsWith(prefix) ? l : prefix + l)).join('\n')
    setDesc(description.slice(0, lineStart) + prefixed + description.slice(e))
    requestAnimationFrame(() => ta.focus())
  }
  function insertLink() {
    const ta = descRef.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const sel = description.slice(s, e) || 'link text'
    const next = description.slice(0, s) + `[${sel}](https://)` + description.slice(e)
    setDesc(next)
    requestAnimationFrame(() => {
      ta.focus()
      const urlStart = s + sel.length + 3
      ta.setSelectionRange(urlStart, urlStart + 8)
    })
  }

  function addFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = ev => {
        const newImg = {
          id: genImgId(),
          name: file.name,
          url: ev.target.result,
          uploadedAt: new Date().toISOString(),
        }
        setImages(prev => {
          if (prev.length === 0) setCoverId(newImg.id)
          return [...prev, newImg]
        })
      }
      reader.readAsDataURL(file)
    })
  }

  function handleDeleteImg(imgId) {
    setImages(prev => {
      const updated = prev.filter(i => i.id !== imgId)
      if (coverId === imgId) setCoverId(updated[0]?.id || null)
      return updated
    })
  }

  function handlePostComment(e) {
    e.preventDefault()
    if (!commentText.trim()) return
    onAddComment(card.id, commentText.trim())
    setComment('')
  }

  function startEditComment(cm) {
    setEditingCommentId(cm.id)
    setEditCommentText(cm.text)
  }
  function saveEditComment() {
    const next = (card.comments || []).map(cm =>
      cm.id === editingCommentId ? { ...cm, text: editCommentText.trim() || cm.text } : cm
    )
    onUpdate(card.id, { comments: next })
    setEditingCommentId(null)
  }

  const comments = [...(card.comments || [])].reverse()

  return (
    <div className="modal-overlay open" ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="tm-modal"
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files) }}
      >

        {/* ── Top-right icons ── */}
        <div className="tm-top-icons">
          <button className="tm-icon-btn" title="Add cover" onClick={() => fileImgRef.current?.click()}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <button className="tm-icon-btn" title="Watch">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <div className="tm-menu-wrap">
            <button className="tm-icon-btn" title="More" onClick={() => setMenuOpen(v => !v)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="tm-pop tm-menu">
                <button onClick={() => { onDuplicate?.(card.id); onClose() }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="13" height="13"/><path d="M8 3h7a2 2 0 0 1 2 2v10"/>
                  </svg>
                  Duplicate
                </button>
                <button className="danger" onClick={() => {
                  if (confirm(`Hapus "${card.title}"?`)) { onDelete(card.id); onClose() }
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
          <button className="tm-icon-btn" title="Close" onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── LEFT ── */}
        <div className={`tm-left ${isDragOver ? 'drag-over' : ''}`}>
          {cover && (
            <div className="tm-cover">
              <img src={cover.url} alt={cover.name} />
            </div>
          )}

          {/* Column badge */}
          <div className="tm-badge-wrap">
            <button className="tm-badge" onClick={() => setColMenuOpen(v => !v)}>
              {columnTitle}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {colMenuOpen && (
              <div className="tm-pop">
                {allColumns.map(col => (
                  <button key={col.id} className={col.id === currentColId ? 'active' : ''}
                    onClick={() => { if (col.id !== currentColId) onMove(card.id, col.id); setColMenuOpen(false) }}>
                    {col.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title with done-checkbox */}
          <div className="tm-title-row">
            <button
              className={`tm-check ${card.posted ? 'done' : ''}`}
              title={card.posted ? 'Mark incomplete' : 'Mark complete'}
              onClick={() => onUpdate(card.id, { posted: !card.posted })}
            >
              {card.posted && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
            <input
              className="tm-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
              placeholder="Card title..."
            />
          </div>

          {/* Pill buttons */}
          <div className="tm-pills">
            <button className="tm-pill" onClick={() => fileImgRef.current?.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add
            </button>

            <div className="tm-pill-wrap">
              <button className="tm-pill" onClick={() => setLabelsOpen(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Labels
              </button>
              {labelsOpen && (
                <div className="tm-pop tm-labels-pop">
                  {LABEL_COLORS.map(c => (
                    <button key={c} className={`tm-label-chip ${c} ${(card.color || 'blue') === c ? 'active' : ''}`}
                      onClick={() => { onUpdate(card.id, { color: c }); setLabelsOpen(false) }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="tm-pill-wrap">
              <button className="tm-pill" onClick={() => setDatesOpen(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Dates
              </button>
              {datesOpen && (
                <div className="tm-pop tm-dates-pop">
                  <input
                    autoFocus
                    placeholder="e.g. 25 Apr"
                    value={due}
                    onChange={e => setDue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { onUpdate(card.id, { due: due.trim() }); setDatesOpen(false) } }}
                  />
                  <div className="tm-pop-actions">
                    <button className="tm-btn-primary" onClick={() => { onUpdate(card.id, { due: due.trim() }); setDatesOpen(false) }}>Save</button>
                    <button className="tm-btn-ghost" onClick={() => { setDue(''); onUpdate(card.id, { due: '' }); setDatesOpen(false) }}>Remove</button>
                  </div>
                </div>
              )}
            </div>

            <button className="tm-pill" title="Checklist (coming soon)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Checklist
            </button>
            <button className="tm-pill" title="Members (coming soon)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Members
            </button>
          </div>

          {/* Due chip */}
          {card.due && (
            <div className="tm-due-display">
              <span className="tm-due-label">Due date</span>
              <span className={`tm-due-chip ${card.posted ? 'done' : ''}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {card.due}
                {card.posted && <span className="tm-due-done-tag">✓ Complete</span>}
              </span>
            </div>
          )}

          {/* Description */}
          <div className="tm-section">
            <div className="tm-section-head">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="11" y2="18"/>
              </svg>
              <span>Description</span>
            </div>

            {editingDesc ? (
              <div className="tm-editor">
                <div className="tm-toolbar">
                  <TbBtn title="Text styles">
                    <span className="tm-tb-tt">Tt</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </TbBtn>
                  <span className="tm-tb-sep" />
                  <TbBtn title="Bold" onClick={() => wrapSelection('**')}>
                    <strong>B</strong>
                  </TbBtn>
                  <TbBtn title="Italic" onClick={() => wrapSelection('*')}>
                    <em style={{ fontFamily: 'Georgia, serif' }}>I</em>
                  </TbBtn>
                  <TbBtn title="More formatting">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                  </TbBtn>
                  <span className="tm-tb-sep" />
                  <TbBtn title="List" onClick={() => prefixLines('- ')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </TbBtn>
                  <span className="tm-tb-sep" />
                  <TbBtn title="Link" onClick={insertLink}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </TbBtn>
                  <TbBtn title="Image" onClick={() => fileImgRef.current?.click()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </TbBtn>
                  <TbBtn title="Insert">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </TbBtn>
                  <span className="tm-tb-spacer" />
                  <TbBtn title="Attachment" onClick={() => fileImgRef.current?.click()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  </TbBtn>
                  <TbBtn title="Markdown">
                    <span className="tm-tb-md">M↓</span>
                  </TbBtn>
                  <TbBtn title="Help">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </TbBtn>
                </div>
                <textarea
                  ref={descRef}
                  autoFocus
                  className="tm-desc-area"
                  placeholder="Add a more detailed description…"
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                />
                <div className="tm-editor-actions">
                  <button className="tm-btn-primary" onClick={saveDesc}>Save</button>
                  <button className="tm-btn-ghost" onClick={cancelDesc}>Cancel</button>
                  <span className="tm-formatting-help">Formatting help</span>
                </div>
              </div>
            ) : (
              card.description
                ? <div className="tm-desc-preview" onClick={() => setEditingDesc(true)}>{renderDescription(card.description)}</div>
                : <button className="tm-desc-placeholder" onClick={() => setEditingDesc(true)}>Add a more detailed description…</button>
            )}
          </div>

          {/* Attachments */}
          {images.length > 0 && (
            <div className="tm-section">
              <div className="tm-section-head">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <span>Attachments</span>
              </div>
              <div className="detail-attachments">
                {images.map(img => (
                  <div key={img.id} className="attachment-item">
                    <img src={img.url} alt={img.name} className="attachment-thumb" />
                    <div className="attachment-info">
                      <span className="attachment-name">{img.name}</span>
                      <span className="attachment-date">Added {relTime(img.uploadedAt)}</span>
                    </div>
                    <div className="attachment-actions">
                      <button
                        className={`attachment-cover-btn ${coverId === img.id ? 'active' : ''}`}
                        onClick={() => setCoverId(img.id)}
                      >
                        {coverId === img.id ? '✓ Cover' : '⊞ Cover'}
                      </button>
                      <button className="attachment-del-btn" onClick={() => handleDeleteImg(img.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <input ref={fileImgRef} type="file" accept="image/*" multiple
            style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        {/* ── RIGHT — Comments and activity ── */}
        <div className="tm-right">
          <div className="tm-right-head">
            <div className="tm-right-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Comments and activity
            </div>
            <button className="tm-show-details" onClick={() => setShowDetails(v => !v)}>
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>

          <form className="tm-comment-form" onSubmit={handlePostComment}>
            <textarea
              className="tm-comment-input"
              placeholder="Write a comment..."
              value={commentText}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(e) } }}
            />
            {commentText.trim() && (
              <div className="tm-comment-form-actions">
                <button type="submit" className="tm-btn-primary">Save</button>
              </div>
            )}
          </form>

          <div className="tm-feed">
            {comments.map(cm => (
              <div key={cm.id} className="tm-feed-item">
                <div className="tm-avatar">{USER_INITIAL}</div>
                <div className="tm-feed-body">
                  <div className="tm-feed-meta">
                    <span className="tm-feed-name">{USER_NAME}</span>
                    <span className="tm-feed-time">{relTime(cm.createdAt)}</span>
                  </div>
                  {editingCommentId === cm.id ? (
                    <div className="tm-comment-edit">
                      <textarea
                        autoFocus
                        value={editCommentText}
                        onChange={e => setEditCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditComment() } }}
                      />
                      <div className="tm-pop-actions">
                        <button className="tm-btn-primary" onClick={saveEditComment}>Save</button>
                        <button className="tm-btn-ghost" onClick={() => setEditingCommentId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="tm-comment-bubble">{cm.text}</div>
                      <div className="tm-comment-actions">
                        <button className="tm-comment-emoji" title="Add reaction">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                          </svg>
                        </button>
                        <span className="tm-dot">•</span>
                        <button className="tm-comment-link" onClick={() => startEditComment(cm)}>Edit</button>
                        <span className="tm-dot">•</span>
                        <button className="tm-comment-link" onClick={() => onDeleteComment(card.id, cm.id)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {showDetails && (
              <div className="tm-feed-item tm-activity">
                <div className="tm-avatar">{USER_INITIAL}</div>
                <div className="tm-feed-body">
                  <div className="tm-activity-text">
                    <span className="tm-feed-name">{USER_NAME}</span> added this card to {columnTitle}
                  </div>
                  <div className="tm-feed-time">{relTime(card.createdAt)}</div>
                </div>
              </div>
            )}

            {comments.length === 0 && !showDetails && (
              <div className="tm-no-comments">No comments yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
