import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cardColor } from '../hooks/useBoard'

function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

export function KanbanCard({ card, index, columns, onDelete, onMove, onClick, onDuplicate }) {
  const [menuOpen, setMenuOpen]   = useState(false)
  const [menuPos, setMenuPos]     = useState({ top: 0, left: 0 })
  const menuBtnRef                = useRef(null)
  const color                     = cardColor(index)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: 'card', card } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  function openMenu(e) {
    e.stopPropagation()
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect()
      const menuHeight = 176 // approx height of menu
      // default: di bawah button
      let top = rect.bottom + 6
      // jika tidak muat di bawah, taruh di atas
      if (top + menuHeight > window.innerHeight - 12) {
        top = rect.top - menuHeight - 6
      }
      const left = Math.min(rect.right - 160, window.innerWidth - 172)
      setMenuPos({ top, left: Math.max(8, left) })
    }
    setMenuOpen(v => !v)
  }

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (!menuBtnRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const dropdown = menuOpen && createPortal(
    <div
      className="card-dropdown-portal"
      style={{ top: menuPos.top, left: menuPos.left }}
      onMouseDown={e => e.stopPropagation()}
    >
      <button className="dropdown-item"
        onClick={e => { e.stopPropagation(); onClick(card); setMenuOpen(false) }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
        View detail
      </button>
      <button className="dropdown-item"
        onClick={e => { e.stopPropagation(); onClick(card); setMenuOpen(false) }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L21 3z"/>
        </svg>
        Edit
      </button>
      <button className="dropdown-item"
        onClick={e => { e.stopPropagation(); onDuplicate?.(card.id); setMenuOpen(false) }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="13" height="13"/><path d="M8 3h7a2 2 0 0 1 2 2v10"/>
        </svg>
        Duplicate
      </button>
      <div className="dropdown-sep" />
      <button className="dropdown-item danger"
        onClick={e => {
          e.stopPropagation()
          if (confirm(`Hapus "${card.title}"?`)) onDelete(card.id)
          setMenuOpen(false)
        }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
        Trash
      </button>
    </div>,
    document.body
  )

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`card ${card.posted ? 'card-done' : ''}`}
        data-color={color}
        {...attributes}
        {...listeners}
      >
        <button
          ref={menuBtnRef}
          className="card-menu-btn"
          onPointerDown={e => e.stopPropagation()}
          onClick={openMenu}
          aria-label="Card options"
        >
          •••
        </button>

        <div
          className="card-body"
          onClick={e => { if (!menuOpen) onClick(card) }}
          style={{ cursor: 'pointer' }}
        >
          {/* Cover image */}
          {card.coverId && card.images?.length > 0 && (() => {
            const cover = card.images.find(i => i.id === card.coverId)
            return cover ? (
              <div className="card-cover">
                <img src={cover.url} alt={cover.name} />
                {card.images.length > 1 && <span className="card-cover-count">{card.images.length}</span>}
              </div>
            ) : null
          })()}
          <p className="card-title">{card.title}</p>
          {card.description && <p className="card-excerpt">{card.description}</p>}
          {(card.due || (card.comments && card.comments.length > 0)) && (
            <div className="card-footer">
              {card.due && (
                <span className={`card-date ${color}`}>
                  <CalIcon />{card.due}
                </span>
              )}
              {card.comments && card.comments.length > 0 && (
                <span className="card-comment-count">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {card.comments.length}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {dropdown}
    </>
  )
}
