import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, closestCorners, defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanColumn } from '../components/KanbanColumn'
import { KanbanCard } from '../components/KanbanCard'
import { CardModal } from '../components/CardModal'
import { ChatPanel } from '../components/ChatPanel'
import { useChat } from '../hooks/useChat'
import { apiUrl } from '../lib/api'

function genId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

function AddColumnForm({ onAdd, onCancel }) {
  const [val, setVal] = useState('')
  return (
    <form className="add-column-form" onSubmit={e => { e.preventDefault(); if (val.trim()) onAdd(val.trim()) }}>
      <input autoFocus placeholder="Column name…" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Escape' && onCancel()} />
      <div className="add-column-actions">
        <button type="submit" className="btn-primary">Add</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

async function fetchShared(token) {
  const res = await fetch(apiUrl(`/api/share/view/${token}`))
  if (!res.ok) throw new Error('Link tidak valid atau sudah dinonaktifkan')
  return res.json()
}

async function saveShared(token, board) {
  await fetch(apiUrl(`/api/share/view/${token}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board }),
  })
}

export function SharedBoardPage({ token }) {
  const [board, setBoard]       = useState(null)
  const [error, setError]       = useState('')
  const [activeItem, setActiveItem] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [modalCard, setModalCard] = useState(null)
  const [newColOpen, setNewColOpen] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('ys-theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])

  useEffect(() => {
    fetchShared(token)
      .then(data => setBoard(data.board))
      .catch(e => setError(e.message))
  }, [token])

  // Debounced auto-save
  function persist(nextBoard) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveShared(token, nextBoard), 900)
  }

  function update(fn) {
    setBoard(prev => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }

  // ── Card handlers ─────────────────────────────────────────────
  function addCard(colId, title, desc = '', due = '') {
    update(b => ({
      ...b,
      columns: b.columns.map(c => c.id === colId
        ? { ...c, cards: [...c.cards, { id: genId(), title, description: desc, due_date: due, posted: false, comments: [], checklist: [] }] }
        : c)
    }))
  }

  function deleteCard(cardId) {
    update(b => ({ ...b, columns: b.columns.map(c => ({ ...c, cards: c.cards.filter(cd => cd.id !== cardId) })) }))
    setModalCard(null)
  }

  function updateCard(cardId, changes) {
    update(b => ({
      ...b,
      columns: b.columns.map(c => ({
        ...c,
        cards: c.cards.map(cd => cd.id === cardId ? { ...cd, ...changes } : cd)
      }))
    }))
  }

  function moveCard(cardId, toColId) {
    update(b => {
      const card = b.columns.flatMap(c => c.cards).find(c => c.id === cardId)
      if (!card) return b
      return {
        ...b,
        columns: b.columns.map(c => {
          if (c.cards.find(cd => cd.id === cardId)) return { ...c, cards: c.cards.filter(cd => cd.id !== cardId) }
          if (c.id === toColId) return { ...c, cards: [...c.cards, card] }
          return c
        })
      }
    })
  }

  function duplicateCard(cardId) {
    update(b => ({
      ...b,
      columns: b.columns.map(c => {
        const idx = c.cards.findIndex(cd => cd.id === cardId)
        if (idx === -1) return c
        const copy = { ...c.cards[idx], id: genId(), title: c.cards[idx].title + ' (copy)' }
        const cards = [...c.cards]
        cards.splice(idx + 1, 0, copy)
        return { ...c, cards }
      })
    }))
  }

  // ── Column handlers ───────────────────────────────────────────
  function addColumn(title) {
    update(b => ({ ...b, columns: [...b.columns, { id: genId(), title, cards: [] }] }))
  }

  function renameColumn(colId, title) {
    update(b => ({ ...b, columns: b.columns.map(c => c.id === colId ? { ...c, title } : c) }))
  }

  function deleteColumn(colId) {
    update(b => ({ ...b, columns: b.columns.filter(c => c.id !== colId) }))
  }

  // ── Comment handler ───────────────────────────────────────────
  function addComment(cardId, text) {
    updateCard(cardId, {
      comments: [
        ...((board?.columns.flatMap(c => c.cards).find(c => c.id === cardId)?.comments) || []),
        { id: genId(), text, created_at: new Date().toISOString() }
      ]
    })
  }

  // ── AI ────────────────────────────────────────────────────────
  const getBoardSummary = useCallback(() => board?.columns || [], [board])
  const getAppContext = useCallback(() => ({ currentPage: 'shared-board' }), [])

  const handleToolCall = useCallback(({ tool, cardId, columnId, title, description, due, toColumnId, changes }) => {
    if (tool === 'add_card') addCard(columnId, title, description, due)
    else if (tool === 'move_card') moveCard(cardId, toColumnId)
    else if (tool === 'update_card') updateCard(cardId, changes || {})
    else if (tool === 'delete_card') deleteCard(cardId)
  }, [board])

  const { messages, loading, sendMessage, stopStream, clearChat, model, setModel } = useChat({
    userId: `shared-${token}`,
    getBoardSummary,
    getAppContext,
    onToolCall: handleToolCall,
  })

  // ── DnD ──────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart({ active }) { setActiveItem(active.id) }

  function handleDragEnd({ active, over }) {
    setActiveItem(null)
    if (!over || active.id === over.id || !board) return
    const cols = board.columns
    const isCol = cols.find(c => c.id === active.id)
    if (isCol) {
      const from = cols.findIndex(c => c.id === active.id)
      const to   = cols.findIndex(c => c.id === over.id)
      if (from !== to) update(b => ({ ...b, columns: arrayMove(b.columns, from, to) }))
      return
    }
    const fromCol = cols.find(c => c.cards.find(cd => cd.id === active.id))
    const toCol   = cols.find(c => c.id === over.id || c.cards.find(cd => cd.id === over.id))
    if (!fromCol || !toCol) return
    if (fromCol.id === toCol.id) {
      const fi = fromCol.cards.findIndex(c => c.id === active.id)
      const ti = fromCol.cards.findIndex(c => c.id === over.id)
      if (fi !== ti) update(b => ({
        ...b,
        columns: b.columns.map(c => c.id === fromCol.id ? { ...c, cards: arrayMove(c.cards, fi, ti) } : c)
      }))
    } else {
      const card = fromCol.cards.find(c => c.id === active.id)
      const ti = toCol.cards.findIndex(c => c.id === over.id)
      update(b => ({
        ...b,
        columns: b.columns.map(c => {
          if (c.id === fromCol.id) return { ...c, cards: c.cards.filter(cd => cd.id !== active.id) }
          if (c.id === toCol.id) {
            const cards = [...c.cards]
            cards.splice(ti >= 0 ? ti : cards.length, 0, card)
            return { ...c, cards }
          }
          return c
        })
      }))
    }
  }

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ color: 'var(--ink)' }}>⚠️ {error}</h2>
      <p style={{ color: 'var(--muted)' }}>Link ini mungkin sudah dinonaktifkan oleh pemiliknya.</p>
    </div>
  )

  if (!board) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: 'var(--muted)' }}>Memuat board…</p>
    </div>
  )

  const colIds = board.columns.map(c => c.id)
  const activeCard = activeItem ? board.columns.flatMap(c => c.cards).find(c => c.id === activeItem) : null
  const activeCol  = activeItem ? board.columns.find(c => c.id === activeItem) : null
  const freshModal = modalCard ? board.columns.flatMap(c => c.cards).find(c => c.id === modalCard.id) : null

  return (
    <div className="app" style={{ flexDirection: 'column', height: '100svh', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header className="topbar-v2">
        <div className="topbar-tabs">
          <button className="board-tab active">
            <span className="board-tab-icon">🌿</span>
            {board.label || 'Shared Board'}
          </button>
        </div>
        <span className="shared-badge">Shared · editable</span>
        <div style={{ flex: 1 }} />
        <button className={`topbar-btn${chatOpen ? ' active' : ''} primary`} onClick={() => setChatOpen(v => !v)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </header>

      {/* ── Row: board + chat panel side by side ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

          <div className="board-frame-wrap" style={{ flex: 1, minWidth: 0 }}>
            <div className="board-frame">
              <div className="board-row">
                <div className="board-dnd-wrapper">
                  <div className="board-container">
                    <div className="board">
                      <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
                        {board.columns.map(col => (
                          <KanbanColumn
                            key={col.id}
                            column={col}
                            allColumns={board.columns}
                            onAddCard={addCard}
                            onDeleteCard={deleteCard}
                            onDeleteColumn={deleteColumn}
                            onRenameColumn={renameColumn}
                            onMoveCard={moveCard}
                            onDuplicateCard={duplicateCard}
                            onCardClick={card => setModalCard(card)}
                          />
                        ))}
                      </SortableContext>
                      {newColOpen
                        ? <AddColumnForm onAdd={name => { addColumn(name); setNewColOpen(false) }} onCancel={() => setNewColOpen(false)} />
                        : <button className="add-column-btn" onClick={() => setNewColOpen(true)}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                            <span className="add-column-label">Add column</span>
                          </button>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
            {activeCard && <div style={{ transform: 'rotate(2deg)', opacity: 0.88 }}><KanbanCard card={activeCard} index={0} columns={board.columns} onDelete={() => {}} onMove={() => {}} onClick={() => {}} /></div>}
            {activeCol  && <div style={{ opacity: 0.88 }}><KanbanColumn column={activeCol} allColumns={[]} onAddCard={() => {}} onDeleteCard={() => {}} onDeleteColumn={() => {}} onMoveCard={() => {}} onCardClick={() => {}} isDragOverlay /></div>}
          </DragOverlay>
        </DndContext>

        {/* Chat panel — sibling board, slide dari kanan */}
        <div className={`chat-panel-wrapper ${chatOpen ? 'open' : ''}`}>
          <div className="chat-panel-backdrop" onClick={() => setChatOpen(false)} />
          <div className="chat-panel">
            <ChatPanel
              messages={messages} loading={loading}
              onSend={sendMessage} stopStream={stopStream}
              model={model} onModelChange={setModel}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>
      </div>

      {freshModal && (
        <CardModal
          card={freshModal}
          allColumns={board.columns}
          onClose={() => setModalCard(null)}
          onUpdate={(id, changes) => updateCard(id, changes)}
          onDelete={deleteCard}
          onMove={moveCard}
          onAddComment={addComment}
        />
      )}
    </div>
  )
}
