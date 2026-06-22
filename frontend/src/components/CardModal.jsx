import { useState, useEffect, useRef } from 'react'
import { dueStatus, STATUS_COLOR, STATUS_LABEL, fmtDueRange, fmtDT } from '../lib/due'
import { dominantColor } from '../lib/dominantColor'
import { uploadFile } from '../lib/api'

const LABEL_COLORS = ['pink', 'green', 'blue', 'yellow', 'purple']

function genImgId() {
  return 'img-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

/* legacy markdown → HTML sederhana (untuk deskripsi lama yang masih plain text) */
function legacyToHtml(text) {
  if (!text) return ''
  if (/<[a-z][\s\S]*>/i.test(text)) return text // udah HTML
  return text.split('\n').map(line => {
    if (!line.trim()) return '<p><br></p>'
    let html = line
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
    if (/^[-*+] /.test(line)) html = '• ' + html.slice(2)
    return `<p>${html}</p>`
  }).join('')
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

/* ── Date picker ala Trello: kalender + start & due + jam ── */
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const DOWS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function toDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toTimeInput(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function DatePicker({ card, onApply, onClose }) {
  const initDue = card.dueAt ? new Date(card.dueAt) : null
  const initStart = card.startAt ? new Date(card.startAt) : null

  const [useStart, setUseStart]   = useState(!!initStart)
  const [useDue, setUseDue]       = useState(!!initDue || !!card.due)
  const [startDate, setStartDate] = useState(initStart ? toDateInput(initStart) : '')
  const [dueDate, setDueDate]     = useState(initDue ? toDateInput(initDue) : toDateInput(new Date()))
  const [dueTime, setDueTime]     = useState(initDue ? toTimeInput(initDue) : '13:00')

  const seed = initDue || new Date()
  const [view, setView] = useState({ y: seed.getFullYear(), m: seed.getMonth() })

  const firstDow = new Date(view.y, view.m, 1).getDay()
  const daysIn = new Date(view.y, view.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysIn; d++) cells.push(d)

  const today = new Date()
  const isToday = d => d === today.getDate() && view.m === today.getMonth() && view.y === today.getFullYear()
  const cellKey = d => toDateInput(new Date(view.y, view.m, d))
  const inRange = d => {
    if (!useStart || !startDate || !useDue || !dueDate) return false
    const k = cellKey(d)
    return k > startDate && k < dueDate
  }

  function pickDay(d) {
    const k = cellKey(d)
    if (useStart && (!startDate || k < startDate)) { setStartDate(k); return }
    setDueDate(k)
    setUseDue(true)
  }

  function nav(delta) {
    setView(v => {
      let m = v.m + delta, y = v.y
      while (m < 0) { m += 12; y-- }
      while (m > 11) { m -= 12; y++ }
      return { y, m }
    })
  }

  function apply() {
    const changes = {}
    if (useDue && dueDate) {
      const [h, mi] = (dueTime || '23:59').split(':')
      const d = new Date(dueDate + 'T00:00:00')
      d.setHours(+h, +mi)
      changes.dueAt = d.toISOString()
      // sync legacy string biar kalender & home tetap jalan
      changes.due = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    } else {
      changes.dueAt = null
      changes.due = ''
    }
    changes.startAt = (useStart && startDate) ? new Date(startDate + 'T09:00:00').toISOString() : null
    onApply(changes)
    onClose()
  }

  return (
    <div className="datepicker tm-pop dp-horizontal" onClick={e => e.stopPropagation()}>
      <div className="datepicker-head">
        <span className="datepicker-title">Dates</span>
        <button className="datepicker-x" onClick={onClose}>×</button>
      </div>

      <div className="dp-cols">
        {/* kiri: kalender */}
        <div className="dp-cal">
          <div className="datepicker-nav">
            <button type="button" className="dp-nav" onClick={() => nav(-12)}>«</button>
            <button type="button" className="dp-nav" onClick={() => nav(-1)}>‹</button>
            <span className="datepicker-month">{MONTHS_ID[view.m]} {view.y}</span>
            <button type="button" className="dp-nav" onClick={() => nav(1)}>›</button>
            <button type="button" className="dp-nav" onClick={() => nav(12)}>»</button>
          </div>

          <div className="datepicker-grid">
            {DOWS.map(d => <span key={d} className="datepicker-dow">{d}</span>)}
            {cells.map((d, i) => d === null
              ? <span key={`x${i}`} />
              : (
                <button
                  key={d}
                  type="button"
                  className={[
                    'datepicker-day',
                    isToday(d) ? 'today' : '',
                    useDue && cellKey(d) === dueDate ? 'due' : '',
                    useStart && cellKey(d) === startDate ? 'start' : '',
                    inRange(d) ? 'range' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => pickDay(d)}
                >
                  {d}
                </button>
              ))}
          </div>
        </div>

        {/* kanan: fields + actions */}
        <div className="dp-side">
          <div className="datepicker-field">
            <span className="datepicker-label">Start date</span>
            <span className="datepicker-row">
              <input type="checkbox" checked={useStart}
                onChange={e => { setUseStart(e.target.checked); if (e.target.checked && !startDate) setStartDate(toDateInput(new Date())) }} />
              <input type="date" disabled={!useStart} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </span>
          </div>

          <div className="datepicker-field">
            <span className="datepicker-label">Due date</span>
            <span className="datepicker-row">
              <input type="checkbox" checked={useDue} onChange={e => setUseDue(e.target.checked)} />
              <input type="date" disabled={!useDue} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </span>
            <span className="datepicker-row" style={{ marginTop: 7 }}>
              <span style={{ width: 16 }} />
              <input type="time" disabled={!useDue} value={dueTime} onChange={e => setDueTime(e.target.value)} />
            </span>
          </div>

          <div className="datepicker-actions">
            <button type="button" className="tm-btn-primary" style={{ flex: 1 }} onClick={apply}>Simpan</button>
            <button type="button" className="tm-btn-ghost" onClick={() => { onApply({ dueAt: null, startAt: null, due: '' }); onClose() }}>Hapus</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Lightbox fullscreen ── */
function Lightbox({ images, index, onClose, onNav, onMakeCover, onDelete, coverId }) {
  const img = images[index]

  useEffect(() => {
    const onKey = e => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNav(1)
      if (e.key === 'ArrowLeft') onNav(-1)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, onNav])

  if (!img) return null

  function download(e) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = img.url
    a.download = img.name || 'image'
    a.click()
  }

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-x" onClick={onClose}>×</button>
      {images.length > 1 && <button className="lightbox-arrow prev" onClick={e => { e.stopPropagation(); onNav(-1) }}>‹</button>}
      {images.length > 1 && <button className="lightbox-arrow next" onClick={e => { e.stopPropagation(); onNav(1) }}>›</button>}

      <img className="lightbox-img" src={img.url} alt={img.name} onClick={e => e.stopPropagation()} />

      <div className="lightbox-panel" onClick={e => e.stopPropagation()}>
        <div className="lightbox-name">{img.name}</div>
        <div className="lightbox-meta">
          Ditambahkan {img.uploadedAt ? fmtDT(img.uploadedAt) : '—'}
          {images.length > 1 && ` · ${index + 1} / ${images.length}`}
        </div>
        <div className="lightbox-actions">
          <button onClick={e => { e.stopPropagation(); window.open(img.url, '_blank') }}>↗ Open in new tab</button>
          <button onClick={download}>⬇ Download</button>
          <button className={coverId === img.id ? 'active' : ''} onClick={e => { e.stopPropagation(); onMakeCover(img.id) }}>
            🖼 {coverId === img.id ? 'Cover ✓' : 'Make cover'}
          </button>
          <button className="danger" onClick={e => { e.stopPropagation(); onDelete(img.id) }}>× Delete</button>
        </div>
      </div>
    </div>
  )
}

export function CardModal({
  card, columnTitle, colIndex, allColumns, user,
  onClose, onUpdate, onDelete, onAddComment, onDeleteComment, onMove, onDuplicate,
}) {
  const USER_NAME = user?.name || 'Anesh'
  const USER_INITIAL = USER_NAME[0].toUpperCase()
  const [title, setTitle]             = useState(card.title)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [descOverflow, setDescOverflow] = useState(false)
  const [commentText, setComment]     = useState('')
  const [images, setImages]           = useState(card.images || [])
  const [coverId, setCoverId]         = useState(card.coverId || null)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [datesOpen, setDatesOpen]     = useState(false)
  const [labelsOpen, setLabelsOpen]   = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [lightbox, setLightbox]       = useState(-1)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editCommentText, setEditCommentText]   = useState('')
  const [isDragOver, setIsDragOver]   = useState(false)
  const [files, setFiles]             = useState(card.files || [])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [checkOpen, setCheckOpen]     = useState((card.checklist || []).length > 0)
  const [copied, setCopied]           = useState(false)
  const [bannerBg, setBannerBg]       = useState(null)
  const [uploadingIds, setUploadingIds] = useState(new Set())
  const [uploadErrors, setUploadErrors] = useState(new Map())
  const [split, setSplit]             = useState(() => {
    const saved = Number(localStorage.getItem('ys-modal-split'))
    return saved >= 45 && saved <= 78 ? saved : 63
  })

  const overlayRef = useRef(null)
  const fileImgRef = useRef(null)
  const richRef    = useRef(null)
  const previewRef = useRef(null)
  const bodyRef    = useRef(null)
  const splitRef   = useRef(split)
  const checkInputRef = useRef(null)
  const skipPersistImages = useRef(true)
  const dragDepth  = useRef(0)

  const currentColId = allColumns.find(col => col.cards?.find(c => c.id === card.id))?.id
  const cover = images.find(i => i.id === coverId)
  const descHtml = legacyToHtml(card.description || '')

  const status = dueStatus(card)
  const dueColor = STATUS_COLOR[status]
  const dueText = fmtDueRange(card)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && lightbox === -1) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, lightbox])

  useEffect(() => {
    skipPersistImages.current = true
    setTitle(card.title)
    setImages(card.images || []); setCoverId(card.coverId || null)
    setFiles(card.files || [])
    setEditingDesc(false); setMenuOpen(false); setColMenuOpen(false)
    setDatesOpen(false); setLabelsOpen(false); setEditingCommentId(null)
    setDescExpanded(false); setLightbox(-1)
    setCheckOpen((card.checklist || []).length > 0)
  }, [card.id])

  // Attachments persist immediately
  useEffect(() => {
    if (skipPersistImages.current) { skipPersistImages.current = false; return }
    onUpdate(card.id, { images, coverId, files })
  }, [images, coverId, files])

  // warna dominan buat banner cover (bukan blur)
  useEffect(() => {
    if (!cover) return
    let alive = true
    dominantColor(cover.url).then(c => { if (alive) setBannerBg(c) })
    return () => { alive = false }
  }, [cover?.url])

  // drag divider antara panel kiri & kanan
  useEffect(() => { splitRef.current = split }, [split])
  function startSplitDrag(e) {
    e.preventDefault()
    const move = ev => {
      const body = bodyRef.current
      if (!body) return
      const r = body.getBoundingClientRect()
      const pct = Math.min(78, Math.max(45, ((ev.clientX - r.left) / r.width) * 100))
      setSplit(pct)
    }
    const up = () => {
      localStorage.setItem('ys-modal-split', String(Math.round(splitRef.current)))
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  // ukur overflow deskripsi → tampilkan "Show more"
  useEffect(() => {
    if (previewRef.current) setDescOverflow(previewRef.current.scrollHeight > 250)
  }, [card.description, editingDesc])

  function commitTitle() {
    const t = title.trim()
    if (!t) { setTitle(card.title); return }
    if (t !== card.title) onUpdate(card.id, { title: t })
  }

  function saveDesc() {
    const html = richRef.current?.innerHTML || ''
    onUpdate(card.id, { description: html })
    setEditingDesc(false)
  }

  /* rich toolbar — execCommand biar bold/italic/list beneran rich */
  function exec(cmd, val = null) {
    richRef.current?.focus()
    document.execCommand(cmd, false, val)
  }
  function insertLink() {
    const url = prompt('URL link:', 'https://')
    if (url) exec('createLink', url)
  }

  function addFiles(fileList) {
    const MAX_RETRIES = 2
    Array.from(fileList).forEach(async file => {
      const fileId = genImgId()
      setUploadingIds(prev => new Set([...prev, fileId]))

      let url
      let lastError
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const uploaded = await uploadFile(file)
          url = uploaded.url
          break
        } catch (err) {
          lastError = err
          if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        }
      }

      if (!url && lastError) {
        // Upload failed after retries — show error and fall back to base64
        const errorMsg = lastError.message || 'Upload gagal'
        setUploadErrors(prev => new Map(prev).set(fileId, `❌ ${file.name}: ${errorMsg}`))
        setTimeout(() => {
          setUploadErrors(prev => {
            const next = new Map(prev)
            next.delete(fileId)
            return next
          })
        }, 5000)

        url = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = ev => resolve(ev.target.result)
          reader.readAsDataURL(file)
        })
      }

      if (file.type.startsWith('image/')) {
        const newImg = { id: fileId, name: file.name, url, uploadedAt: new Date().toISOString() }
        setImages(prev => {
          if (prev.length === 0) setCoverId(fileId)
          return [...prev, newImg]
        })
      } else {
        const newFile = {
          id: fileId, name: file.name, url,
          size: file.size, type: file.type || 'file', uploadedAt: new Date().toISOString(),
        }
        setFiles(prev => [...prev, newFile])
      }

      setUploadingIds(prev => {
        const next = new Set(prev)
        next.delete(fileId)
        return next
      })
    })
  }

  /* checklist */
  const checklist = card.checklist || []
  const checkDone = checklist.filter(i => i.done).length
  function addCheckItem(e) {
    e.preventDefault()
    const text = newCheckItem.trim()
    if (!text) return
    onUpdate(card.id, { checklist: [...checklist, { id: genImgId(), text, done: false }] })
    setNewCheckItem('')
  }
  function toggleCheckItem(id) {
    onUpdate(card.id, { checklist: checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) })
  }
  function deleteCheckItem(id) {
    onUpdate(card.id, { checklist: checklist.filter(i => i.id !== id) })
  }

  function copyCardLink() {
    const link = `${location.origin}${location.pathname}#card=${card.id}`
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => { setCopied(false); setMenuOpen(false) }, 1200)
  }

  function fmtSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function handleDeleteImg(imgId) {
    setImages(prev => {
      const updated = prev.filter(i => i.id !== imgId)
      if (coverId === imgId) setCoverId(updated[0]?.id || null)
      if (lightbox >= updated.length) setLightbox(updated.length - 1)
      if (updated.length === 0) setLightbox(-1)
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
  const hasDesc = !!(card.description || '').replace(/<[^>]*>/g, '').trim()

  return (
    <div className="modal-overlay open" ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="tm-modal"
        onDragEnter={e => { e.preventDefault(); dragDepth.current++; setIsDragOver(true) }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setIsDragOver(false) }}
        onDrop={e => { e.preventDefault(); dragDepth.current = 0; setIsDragOver(false); addFiles(e.dataTransfer.files) }}
      >

        {/* drop overlay — seluruh pop-up jadi drop zone */}
        {isDragOver && (
          <div className="tm-drop-overlay">
            <div className="tm-drop-overlay-inner">
              <span className="tm-drop-emoji">📎</span>
              Lepas file di sini — gambar & dokumen
            </div>
          </div>
        )}

        {/* ── Cover banner paling atas (full width, bg warna dominan) ── */}
        {cover && (
          <div className="tm-cover-banner" style={{ background: bannerBg || '#ECEAE2' }}
            onClick={() => setLightbox(images.findIndex(i => i.id === cover.id))} title="Klik untuk lihat full">
            <img className="tm-cover-banner-img" src={cover.url} alt={cover.name} />
            {images.length > 1 && <span className="tm-cover-count">{images.length} gambar</span>}
          </div>
        )}

        {/* ── Top-right icons ── */}
        <div className={`tm-top-icons ${cover ? 'on-cover' : ''}`}>
          <button className="tm-icon-btn" title="Add cover" onClick={() => fileImgRef.current?.click()}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
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
                <button onClick={copyCardLink}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  {copied ? 'Link copied ✓' : 'Copy link'}
                </button>
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

        <div className="tm-body" ref={bodyRef}>
          {/* ── LEFT ── */}
          <div className="tm-left" style={{ width: `${split}%`, flex: 'none' }}>
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
                  <DatePicker
                    card={card}
                    onApply={changes => onUpdate(card.id, changes)}
                    onClose={() => setDatesOpen(false)}
                  />
                )}
              </div>

              <button className="tm-pill" title="Checklist"
                onClick={() => { setCheckOpen(true); setTimeout(() => checkInputRef.current?.focus(), 80) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                Checklist
              </button>
            </div>

            {/* Dates display — warna status: merah/kuning/biru/krem/hijau */}
            {(dueText || card.startAt) && (
              <div className="tm-due-display">
                <span className="tm-due-label">Dates</span>
                <button className={`tm-due-chip due-${dueColor}`} onClick={() => setDatesOpen(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {dueText}
                  {STATUS_LABEL[status] && <span className={`due-badge badge-${dueColor}`}>{STATUS_LABEL[status]}</span>}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
            )}

            {/* Description — rich + collapse */}
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
                    <TbBtn title="Bold" onClick={() => exec('bold')}><strong>B</strong></TbBtn>
                    <TbBtn title="Italic" onClick={() => exec('italic')}><em style={{ fontFamily: 'Georgia, serif' }}>I</em></TbBtn>
                    <TbBtn title="Underline" onClick={() => exec('underline')}><span style={{ textDecoration: 'underline' }}>U</span></TbBtn>
                    <TbBtn title="Strikethrough" onClick={() => exec('strikeThrough')}><span style={{ textDecoration: 'line-through' }}>S</span></TbBtn>
                    <span className="tm-tb-sep" />
                    <TbBtn title="Heading" onClick={() => exec('formatBlock', '<h3>')}><span className="tm-tb-tt">H</span></TbBtn>
                    <TbBtn title="Paragraph" onClick={() => exec('formatBlock', '<p>')}><span className="tm-tb-tt">¶</span></TbBtn>
                    <span className="tm-tb-sep" />
                    <TbBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    </TbBtn>
                    <TbBtn title="Numbered list" onClick={() => exec('insertOrderedList')}><span className="tm-tb-tt">1.</span></TbBtn>
                    <TbBtn title="Garis pemisah" onClick={() => exec('insertHorizontalRule')}><span className="tm-tb-tt">—</span></TbBtn>
                    <span className="tm-tb-sep" />
                    <TbBtn title="Link" onClick={insertLink}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </TbBtn>
                    <TbBtn title="Hapus format" onClick={() => exec('removeFormat')}><span className="tm-tb-tt">⌫</span></TbBtn>
                  </div>
                  <div
                    ref={richRef}
                    className="tm-rich-area"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Tulis deskripsi… paste dari Docs/Notion — bold, heading, list, semua format kebawa ✨"
                    dangerouslySetInnerHTML={{ __html: descHtml }}
                  />
                  <div className="tm-editor-actions">
                    <button className="tm-btn-primary" onClick={saveDesc}>Save</button>
                    <button className="tm-btn-ghost" onClick={() => setEditingDesc(false)}>Cancel</button>
                    <span className="tm-formatting-help">Paste dari Google Docs / Notion → format ikut kebawa</span>
                  </div>
                </div>
              ) : (
                hasDesc
                  ? (
                    <div className="tm-desc-collapse-wrap">
                      <div
                        ref={previewRef}
                        className={`tm-desc-preview tm-desc-rich ${descOverflow && !descExpanded ? 'collapsed' : ''}`}
                        onClick={() => setEditingDesc(true)}
                        dangerouslySetInnerHTML={{ __html: descHtml }}
                      />
                      {descOverflow && (
                        <button className="tm-show-more" onClick={() => setDescExpanded(v => !v)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: descExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                          {descExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )
                  : <button className="tm-desc-placeholder" onClick={() => setEditingDesc(true)}>Add a more detailed description…</button>
              )}
            </div>

            {/* Checklist */}
            {(checkOpen || checklist.length > 0) && (
              <div className="tm-section">
                <div className="tm-section-head">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  <span>Checklist</span>
                  {checklist.length > 0 && <span className="tm-check-count">{checkDone}/{checklist.length}</span>}
                </div>

                {checklist.length > 0 && (
                  <div className="tm-check-progress">
                    <span className="tm-check-pct">{Math.round((checkDone / checklist.length) * 100)}%</span>
                    <div className="tm-check-bar">
                      <div className={`tm-check-fill ${checkDone === checklist.length ? 'complete' : ''}`}
                        style={{ width: `${(checkDone / checklist.length) * 100}%` }} />
                    </div>
                  </div>
                )}

                <div className="tm-check-list">
                  {checklist.map(item => (
                    <div key={item.id} className={`tm-check-item ${item.done ? 'done' : ''}`}>
                      <button className={`tm-check ${item.done ? 'done' : ''}`} onClick={() => toggleCheckItem(item.id)}>
                        {item.done && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                      <span className="tm-check-text">{item.text}</span>
                      <button className="tm-check-del" onClick={() => deleteCheckItem(item.id)}>×</button>
                    </div>
                  ))}
                </div>

                <form className="tm-check-add" onSubmit={addCheckItem}>
                  <input
                    ref={checkInputRef}
                    placeholder="Tambah item…"
                    value={newCheckItem}
                    onChange={e => setNewCheckItem(e.target.value)}
                  />
                  {newCheckItem.trim() && <button type="submit" className="tm-btn-primary">Add</button>}
                </form>
              </div>
            )}

            {/* Attachments */}
            {(images.length > 0 || files.length > 0 || uploadingIds.size > 0) && (
              <div className="tm-section">
                <div className="tm-section-head">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  <span>Attachments</span>
                </div>
                {uploadingIds.size > 0 && (
                  <div className="tm-uploading-banner">
                    <div className="tm-spinner">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin .8s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeDasharray="16" strokeDashoffset="0" />
                      </svg>
                    </div>
                    <span>Uploading {uploadingIds.size} file{uploadingIds.size > 1 ? 's' : ''}…</span>
                  </div>
                )}
                {uploadErrors.size > 0 && (
                  <div className="tm-upload-errors">
                    {Array.from(uploadErrors.values()).map((msg, i) => (
                      <div key={i} className="tm-error-msg">{msg}</div>
                    ))}
                  </div>
                )}
                <div className="detail-attachments">
                  {images.map((img, idx) => (
                    <div key={img.id} className="attachment-item">
                      <img src={img.url} alt={img.name} className="attachment-thumb" style={{ cursor: 'zoom-in' }}
                        onClick={() => setLightbox(idx)} />
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

                  {/* file non-gambar */}
                  {files.map(f => (
                    <div key={f.id} className="attachment-item">
                      <span className="attachment-file-icon">📄</span>
                      <div className="attachment-info">
                        <span className="attachment-name">{f.name}</span>
                        <span className="attachment-date">{fmtSize(f.size)} · {relTime(f.uploadedAt)}</span>
                      </div>
                      <div className="attachment-actions">
                        <a className="attachment-cover-btn" href={f.url} download={f.name}>⬇ Download</a>
                        <button className="attachment-del-btn" onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}>
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

            <input ref={fileImgRef} type="file" multiple
              style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          </div>

          {/* ── garis pemisah, drag buat resize ── */}
          <div className="tm-split" onMouseDown={startSplitDrag} title="Tarik buat atur lebar panel">
            <span className="tm-split-line" />
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

        {/* Lightbox fullscreen */}
        {lightbox >= 0 && (
          <Lightbox
            images={images}
            index={lightbox}
            coverId={coverId}
            onClose={() => setLightbox(-1)}
            onNav={d => setLightbox(i => (i + d + images.length) % images.length)}
            onMakeCover={id => setCoverId(id)}
            onDelete={handleDeleteImg}
          />
        )}
      </div>
    </div>
  )
}
