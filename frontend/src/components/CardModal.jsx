import { useState, useEffect, useRef, useCallback } from 'react'
import { cardColor } from '../hooks/useBoard'

function CalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function genImgId() {
  return 'img-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

export function CardModal({
  card, columnTitle, colIndex, allColumns,
  onClose, onUpdate, onDelete, onAddComment, onDeleteComment, onMove, onDuplicate,
}) {
  const [title, setTitle]       = useState(card.title)
  const [description, setDesc]  = useState(card.description || '')
  const [due, setDue]           = useState(card.due || '')
  const [commentText, setComment] = useState('')
  const [images, setImages]     = useState(card.images || [])
  const [coverId, setCoverId]   = useState(card.coverId || null)
  const [imgIdx, setImgIdx]     = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)

  const overlayRef = useRef(null)
  const fileImgRef = useRef(null)
  const color = cardColor(colIndex >= 0 ? colIndex : 0)
  const currentColId = allColumns.find(col => col.cards?.find(c => c.id === card.id))?.id

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setTitle(card.title); setDesc(card.description || ''); setDue(card.due || '')
    setImages(card.images || []); setCoverId(card.coverId || null); setImgIdx(0)
  }, [card.id])

  // clamp imgIdx
  useEffect(() => {
    if (imgIdx >= images.length && images.length > 0) setImgIdx(images.length - 1)
  }, [images.length])

  function handleSave() {
    onUpdate(card.id, { title, description, due, images, coverId })
    onClose()
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
          const updated = [...prev, newImg]
          if (updated.length === 1) setCoverId(newImg.id)
          return updated
        })
      }
      reader.readAsDataURL(file)
    })
  }

  function handleImgUpload(e) {
    addFiles(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    addFiles(e.dataTransfer.files)
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

  function formatTime(iso) {
    try { return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  return (
    <div className="modal-overlay open" ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="detail-modal">

        {/* ── LEFT ── */}
        <div className="detail-modal-left">
          {/* Title */}
          <div className="detail-title-wrap">
            <input className="detail-title-input" value={title}
              onChange={e => setTitle(e.target.value)} placeholder="Card title..." />
          </div>

          {/* Meta */}
          <div className="detail-meta">
            <span className="detail-chip detail-chip-col">{columnTitle}</span>
            {due && (
              <span className={`detail-chip detail-chip-date ${color}`}>
                <CalIcon /> {due}
              </span>
            )}
            {card.posted && <span className="detail-chip detail-chip-date green">✓ Done</span>}
          </div>

          {/* ── IMAGES ── */}
          <div className="detail-section-block">
            <div className="detail-section-label">IMAGES</div>

            {/* Drop zone / carousel */}
            <div
              className={`detail-drop-zone ${isDragOver ? 'drag-over' : ''} ${images.length > 0 ? 'has-image' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => images.length === 0 && fileImgRef.current?.click()}
            >
              {images.length === 0 ? (
                <div className="drop-zone-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <p>Drag & drop gambar di sini</p>
                  <span>atau klik untuk pilih file</span>
                </div>
              ) : (
                <>
                  <img src={images[imgIdx]?.url} alt={images[imgIdx]?.name} className="detail-img-main" />
                  {images.length > 1 && (
                    <>
                      <button className="carousel-btn carousel-prev"
                        onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length) }}>‹</button>
                      <button className="carousel-btn carousel-next"
                        onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length) }}>›</button>
                      <div className="carousel-dots">
                        {images.map((_, i) => (
                          <span key={i} className={`carousel-dot ${i === imgIdx ? 'active' : ''}`}
                            onClick={e => { e.stopPropagation(); setImgIdx(i) }} />
                        ))}
                      </div>
                      <div className="carousel-count">{images.length}</div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Image action buttons */}
            {images.length > 0 && (
              <div className="detail-img-actions">
                <button className="detail-action-btn-sm" onClick={() => fileImgRef.current?.click()}>
                  + Tambah gambar
                </button>
                <button className="detail-action-btn-sm danger" onClick={() => handleDeleteImg(images[imgIdx]?.id)}>
                  × Hapus ini
                </button>
              </div>
            )}
          </div>

          <input ref={fileImgRef} type="file" accept="image/*" multiple
            style={{ display: 'none' }} onChange={handleImgUpload} />

          {/* ── ATTACHMENTS ── */}
          {images.length > 0 && (
            <div className="detail-section-block">
              <div className="detail-section-label">ATTACHMENTS</div>
              <div className="detail-attachments">
                {images.map(img => (
                  <div key={img.id} className="attachment-item">
                    <img src={img.url} alt={img.name} className="attachment-thumb" />
                    <div className="attachment-info">
                      <span className="attachment-name">{img.name}</span>
                      <span className="attachment-date">Diupload {formatTime(img.uploadedAt)}</span>
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
              <button className="detail-action-btn-sm" style={{ marginTop: 8 }} onClick={() => fileImgRef.current?.click()}>
                + Tambah file
              </button>
            </div>
          )}

          {/* ── DESCRIPTION ── */}
          <div className="detail-section-block">
            <div className="detail-section-label">DESCRIPTION</div>
            <textarea className="detail-desc-area" placeholder="Add a description…"
              value={description} onChange={e => setDesc(e.target.value)} />
          </div>

          {/* ── DUE DATE ── */}
          <div className="detail-section-block">
            <div className="detail-section-label">DUE DATE</div>
            <input className="detail-due-input" placeholder="e.g. 25 Apr"
              value={due} onChange={e => setDue(e.target.value)} />
          </div>

          {/* ── MOVE TO COLUMN ── */}
          <div className="detail-section-block">
            <div className="detail-section-label">MOVE TO COLUMN</div>
            <div className="detail-move-cols">
              {allColumns.map(col => (
                <button key={col.id}
                  className={`detail-move-btn ${col.id === currentColId ? 'active' : ''}`}
                  onClick={() => { onMove(card.id, col.id); onClose() }}>
                  {col.title}
                </button>
              ))}
            </div>
          </div>

          {/* ── ACTIONS ── */}
          <div className="detail-actions">
            <button className="detail-save-btn" onClick={handleSave}>Save</button>
            <button className="detail-action-btn" onClick={() => onUpdate(card.id, { posted: !card.posted })}>
              {card.posted ? '↩ Mark undone' : '✓ Mark done'}
            </button>
            <button className="detail-action-btn" onClick={() => { onDuplicate?.(card.id); onClose() }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="13" height="13"/><path d="M8 3h7a2 2 0 0 1 2 2v10"/>
              </svg>
              Duplicate
            </button>
            <button className="detail-action-btn danger" onClick={() => {
              if (confirm(`Hapus "${card.title}"?`)) { onDelete(card.id); onClose() }
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        </div>

        {/* ── RIGHT — Comments ── */}
        <div className="detail-modal-right">
          <div className="comments-panel-head">COMMENTS & ACTIVITY</div>
          <div className="comments-list">
            {(card.comments || []).length === 0
              ? <div className="no-comments">No comments yet</div>
              : (card.comments || []).map(cm => (
                <div key={cm.id} className="comment-item">
                  <p className="comment-text">{cm.text}</p>
                  <p className="comment-time">{formatTime(cm.createdAt)}</p>
                  <button className="comment-delete" onClick={() => onDeleteComment(card.id, cm.id)}>×</button>
                </div>
              ))
            }
          </div>
          <div className="comments-input-wrap">
            <form onSubmit={handlePostComment}>
              <textarea className="comments-textarea" placeholder="Write a comment..."
                value={commentText} onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(e) } }} />
              <button type="submit" className="comments-post-btn">Post</button>
            </form>
          </div>
        </div>

        {/* Close button */}
        <button className="detail-modal-close" onClick={onClose}>×</button>
      </div>
    </div>
  )
}
