import { useState, useCallback } from 'react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragOverlay, closestCorners, defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext,
  horizontalListSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { KanbanColumn } from './components/KanbanColumn'
import { KanbanCard } from './components/KanbanCard'
import { CardModal } from './components/CardModal'
import { ChatPanel } from './components/ChatPanel'
import { useMultiBoard } from './hooks/useBoard'
import { useChat } from './hooks/useChat'
import './App.css'

// Sidebar icons
function SidebarIcon({ active, title, onClick, children }) {
  return (
    <button className={`sb-icon ${active ? 'active' : ''}`} title={title} onClick={onClick}>
      {children}
    </button>
  )
}

export default function App() {
  const [chatOpen, setChatOpen]         = useState(false)
  const [activeItem, setActiveItem]     = useState(null)
  const [modalCard, setModalCard]       = useState(null)
  const [newColOpen, setNewColOpen]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchOpen, setSearchOpen]     = useState(false)
  const [filterOpen, setFilterOpen]     = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [addingTab, setAddingTab]       = useState(false)
  const [newTabName, setNewTabName]     = useState('')

  const {
    board, boards, activeId,
    addTab, switchTab, deleteTab,
    addCard, updateCard, deleteCard, duplicateCard, moveCard, setColumns,
    addColumn, renameColumn, deleteColumn, addComment, deleteComment, getBoardSummary,
  } = useMultiBoard()

  // ── AI chat ────────────────────────────────────────────────────
  const handleToolCall = useCallback((action) => {
    switch (action.tool) {
      case 'add_card':    addCard(action.columnId, action.title, action.description || '', action.due || ''); break
      case 'update_card': updateCard(action.cardId, action.changes || {}); break
      case 'move_card':   moveCard(action.cardId, action.targetColumnId); break
      case 'delete_card': deleteCard(action.cardId); break
    }
  }, [addCard, updateCard, moveCard, deleteCard])

  const { messages, loading, sendMessage, stopStream, model, setModel } = useChat({ getBoardSummary, onToolCall: handleToolCall })

  // ── Filter / Search ────────────────────────────────────────────
  const COLOR_FILTERS = ['all', 'pink', 'green', 'blue', 'yellow', 'purple']
  const filteredBoard = {
    ...board,
    columns: board.columns.map(col => ({
      ...col,
      cards: col.cards.filter(card => {
        const q = searchQuery.toLowerCase()
        const matchSearch = !q ||
          card.title.toLowerCase().includes(q) ||
          (card.description || '').toLowerCase().includes(q)
        const matchFilter = activeFilter === 'all' || (card.color || 'blue') === activeFilter
        return matchSearch && matchFilter
      }),
    })),
  }

  // ── DnD ────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function findContainer(id) {
    if (board.columns.find(c => c.id === id)) return id
    for (const col of board.columns)
      if (col.cards.find(c => c.id === id)) return col.id
    return null
  }

  function handleDragStart({ active }) {
    const isColumn = !!board.columns.find(c => c.id === active.id)
    const card = !isColumn ? board.columns.flatMap(c => c.cards).find(c => c.id === active.id) : null
    const col  = isColumn  ? board.columns.find(c => c.id === active.id) : null
    setActiveItem(isColumn ? { type: 'column', data: col } : { type: 'card', data: card })
  }

  function handleDragOver({ active, over }) {
    if (!over) return
    const activeIsColumn = !!board.columns.find(c => c.id === active.id)
    if (activeIsColumn) return
    const activeColId = findContainer(active.id)
    const overColId   = findContainer(over.id)
    if (!activeColId || !overColId || activeColId === overColId) return
    setColumns(prev => {
      const fromCol = prev.find(c => c.id === activeColId)
      const toCol   = prev.find(c => c.id === overColId)
      const card    = fromCol?.cards.find(c => c.id === active.id)
      if (!card) return prev
      const overIdx  = toCol.cards.findIndex(c => c.id === over.id)
      const insertAt = overIdx >= 0 ? overIdx : toCol.cards.length
      return prev.map(col => {
        if (col.id === activeColId) return { ...col, cards: col.cards.filter(c => c.id !== active.id) }
        if (col.id === overColId) {
          const cards = [...col.cards]
          cards.splice(insertAt, 0, card)
          return { ...col, cards }
        }
        return col
      })
    })
  }

  function handleDragEnd({ active, over }) {
    setActiveItem(null)
    if (!over || active.id === over.id) return
    const activeIsColumn = !!board.columns.find(c => c.id === active.id)
    if (activeIsColumn) {
      const overIsColumn = !!board.columns.find(c => c.id === over.id)
      if (!overIsColumn) return
      setColumns(prev => {
        const oldIdx = prev.findIndex(c => c.id === active.id)
        const newIdx = prev.findIndex(c => c.id === over.id)
        if (oldIdx < 0 || newIdx < 0) return prev
        return arrayMove(prev, oldIdx, newIdx)
      })
      return
    }
    const activeColId = findContainer(active.id)
    const overColId   = findContainer(over.id)
    if (!activeColId || !overColId || activeColId !== overColId) return
    setColumns(prev => prev.map(col => {
      if (col.id !== activeColId) return col
      const oldIdx = col.cards.findIndex(c => c.id === active.id)
      const newIdx = col.cards.findIndex(c => c.id === over.id)
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return col
      return { ...col, cards: arrayMove(col.cards, oldIdx, newIdx) }
    }))
  }

  function findCardColumn(cardId) {
    return board.columns.find(col => col.cards.find(c => c.id === cardId))
  }
  const colIndex = modalCard ? board.columns.findIndex(col => col.cards.find(c => c.id === modalCard.id)) : 0
  const freshModalCard = modalCard ? board.columns.flatMap(c => c.cards).find(c => c.id === modalCard.id) : null
  const dropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }
  const columnIds = board.columns.map(c => c.id)

  function handleAddTab() {
    const name = newTabName.trim() || `Board ${boards.length + 1}`
    addTab(name)
    setNewTabName('')
    setAddingTab(false)
  }

  return (
    <div className="app">

      {/* ── Sidebar ── */}
      <aside className="sidebar-v2">
        <div className="sb-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
        </div>
        <div className="sb-icons-top">
          <SidebarIcon title="Home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Search" onClick={() => setSearchOpen(v => !v)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Board" active>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Analytics">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Calendar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Team">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </SidebarIcon>
        </div>
        <div className="sb-icons-bottom">
          <SidebarIcon title="Docs">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Activity">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </SidebarIcon>
          <div className="sb-avatar">A</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">

        {/* ── Topbar ── */}
        <header className="topbar-v2">
          {/* Tabs */}
          <div className="topbar-tabs">
            {boards.map(b => (
              <button
                key={b.id}
                className={`board-tab ${b.id === activeId ? 'active' : ''}`}
                onClick={() => switchTab(b.id)}
                onContextMenu={e => {
                  e.preventDefault()
                  if (boards.length > 1 && confirm(`Hapus tab "${b.label}"?`)) deleteTab(b.id)
                }}
              >
                <span className="board-tab-icon">🌿</span>
                {b.label}
              </button>
            ))}
            {addingTab ? (
              <form className="tab-add-form" onSubmit={e => { e.preventDefault(); handleAddTab() }}>
                <input
                  autoFocus
                  value={newTabName}
                  onChange={e => setNewTabName(e.target.value)}
                  placeholder="Nama board..."
                  onBlur={handleAddTab}
                  onKeyDown={e => e.key === 'Escape' && setAddingTab(false)}
                />
              </form>
            ) : (
              <button className="tab-add-btn" onClick={() => setAddingTab(true)} title="Add board">+</button>
            )}
          </div>

          <div className="topbar-spacer" />

          {/* Search */}
          {searchOpen && (
            <input autoFocus className="topbar-search-input" placeholder="Cari card..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false) } }} />
          )}

          <button className={`topbar-btn ${searchOpen ? 'active' : ''}`} onClick={() => {
            if (searchOpen) { setSearchQuery(''); setSearchOpen(false) } else setSearchOpen(true)
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Search
          </button>

          <button className={`topbar-btn ${filterOpen ? 'active' : ''}`} onClick={() => setFilterOpen(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            Filter
          </button>

          <button className="topbar-btn primary" onClick={() => setChatOpen(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            AI Chat
          </button>
        </header>

        {/* ── Filter Bar ── */}
        {filterOpen && (
          <div className="filter-bar open">
            <span className="filter-label">Color:</span>
            {COLOR_FILTERS.map(f => (
              <button key={f} className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* ── Board Frame ── */}
        <div className="board-frame-wrap">
          <div className="board-frame">
            <div className="board-row">
              <div className="board-dnd-wrapper">
                <DndContext sensors={sensors} collisionDetection={closestCorners}
                  onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                  <div className="board-container">
                    <div className="board">
                      <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                        {filteredBoard.columns.map(col => (
                          <KanbanColumn
                            key={col.id} column={col} allColumns={board.columns}
                            onAddCard={addCard} onDeleteCard={deleteCard}
                            onDeleteColumn={deleteColumn} onRenameColumn={renameColumn}
                            onMoveCard={moveCard} onDuplicateCard={duplicateCard}
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
                  <DragOverlay dropAnimation={dropAnimation}>
                    {activeItem?.type === 'card' && (
                      <div style={{ transform: 'rotate(2deg)', opacity: 0.88 }}>
                        <KanbanCard card={activeItem.data} index={0} columns={board.columns} onDelete={() => {}} onMove={() => {}} onClick={() => {}} />
                      </div>
                    )}
                    {activeItem?.type === 'column' && (
                      <div style={{ opacity: 0.88 }}>
                        <KanbanColumn column={activeItem.data} allColumns={[]} onAddCard={() => {}} onDeleteCard={() => {}} onDeleteColumn={() => {}} onMoveCard={() => {}} onCardClick={() => {}} isDragOverlay />
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chat Panel ── */}
      <div className={`chat-panel-wrapper ${chatOpen ? 'open' : ''}`}>
        <div className="chat-panel-backdrop" onClick={() => setChatOpen(false)} />
        <div className="chat-panel">
          <ChatPanel
            messages={messages} loading={loading}
            onSend={sendMessage} stopStream={stopStream}
            onClose={() => setChatOpen(false)}
            model={model} onModelChange={setModel}
          />
        </div>
      </div>

      {freshModalCard && (
        <CardModal
          card={freshModalCard}
          columnTitle={findCardColumn(freshModalCard.id)?.title || ''}
          colIndex={colIndex} allColumns={board.columns}
          onClose={() => setModalCard(null)}
          onUpdate={updateCard} onDelete={deleteCard}
          onAddComment={addComment} onDeleteComment={deleteComment}
          onMove={moveCard} onDuplicate={duplicateCard}
        />
      )}
    </div>
  )
}

function AddColumnForm({ onAdd, onCancel }) {
  const [val, setVal] = useState('')
  return (
    <form className="add-column-form" onSubmit={e => { e.preventDefault(); if (val.trim()) onAdd(val.trim()) }}>
      <input autoFocus placeholder="Column name…" value={val} onChange={e => setVal(e.target.value)} />
      <div className="add-column-actions">
        <button type="submit" className="btn-primary">Add</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
