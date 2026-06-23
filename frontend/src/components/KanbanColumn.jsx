import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { KanbanCard } from './KanbanCard'

export function KanbanColumn({
  column, allColumns, onAddCard, onDeleteCard, onDeleteColumn,
  onMoveCard, onDuplicateCard, onCardClick, isDragOverlay, onRenameColumn,
}) {
  const [adding, setAdding]   = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue]   = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(column.title)

  function commitRename() {
    const t = titleDraft.trim()
    if (t && t !== column.title) onRenameColumn?.(column.id, t)
    setEditingTitle(false)
  }

  // Column is sortable itself
  const {
    attributes, listeners, setNodeRef: setSortableRef,
    transform, transition, isDragging,
  } = useSortable({ id: column.id, data: { type: 'column', column } })

  // Also droppable for cards
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: column.id, data: { type: 'column', columnId: column.id },
  })

  // Merge refs
  function mergeRef(el) {
    setSortableRef(el)
    setDropRef(el)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    onAddCard(column.id, newTitle.trim(), '', newDue.trim())
    setNewTitle(''); setNewDue(''); setAdding(false)
  }

  const cardIds = column.cards.map(c => c.id)

  return (
    <div
      ref={isDragOverlay ? undefined : mergeRef}
      style={isDragOverlay ? undefined : style}
      className="column"
    >
      <div className="column-sticky">
        <div className="column-header">
          {/* Drag handle — only the header grabs column */}
          <div
            className="column-drag-handle"
            {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
            title="Drag to reorder"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.4">
              <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
            </svg>
          </div>
          {editingTitle
            ? <input
                className="column-title-input"
                value={titleDraft}
                autoFocus
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setTitleDraft(column.title); setEditingTitle(false) } }}
                onPointerDown={e => e.stopPropagation()}
              />
            : <span className="column-title" onClick={e => { e.stopPropagation(); setTitleDraft(column.title); setEditingTitle(true) }}>{column.title}</span>
          }
          <span className="column-count">{column.cards.length}</span>
          <div style={{ position: 'relative' }}>
            <button
              className="column-menu-btn"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="column-dropdown" onMouseLeave={() => setMenuOpen(false)}>
                <button className="dropdown-item" onPointerDown={e=>e.stopPropagation()} onClick={() => { setAdding(true); setMenuOpen(false) }}>Add card</button>
                <div className="dropdown-sep"/>
                <button className="dropdown-item danger" onPointerDown={e=>e.stopPropagation()} onClick={() => { onDeleteColumn(column.id); setMenuOpen(false) }}>Delete column</button>
              </div>
            )}
          </div>
        </div>

        <button
          className="add-card-btn"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setAdding(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add card
        </button>
      </div>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          className="column-cards"
          style={{ background: isOver ? 'rgba(208,2,27,0.04)' : undefined }}
        >
          {adding && (
            <form className="add-card-form" onSubmit={handleAdd} onPointerDown={e => e.stopPropagation()}>
              <input autoFocus placeholder="Card title…" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <input placeholder="Due date (e.g. 25 Apr)" value={newDue} onChange={e => setNewDue(e.target.value)} />
              <div className="add-card-form-actions">
                <button type="submit" className="btn-primary">Add</button>
                <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          )}

          {column.cards.map((card, i) => (
            <KanbanCard
              key={card.id}
              card={card}
              index={i}
              columns={allColumns}
              onDelete={onDeleteCard}
              onMove={onMoveCard}
              onDuplicate={onDuplicateCard}
              onClick={onCardClick}
            />
          ))}

          {column.cards.length === 0 && !adding && (
            <div className="empty-col">Drop cards here</div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
