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
import { useAttendance, fmtDuration } from './hooks/useAttendance'
import { useTeam } from './hooks/useTeam'
import { useActivity } from './hooks/useActivity'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { ClockPage } from './pages/ClockPage'
import { CalendarPage } from './pages/CalendarPage'
import { TeamPage } from './pages/TeamPage'
import { PayrollPage } from './pages/PayrollPage'
import logo from './assets/logo.png'
import './App.css'

const PAGES = ['home', 'search', 'board', 'absen', 'calendar', 'team', 'payroll']

// Sidebar icons
function SidebarIcon({ active, title, onClick, children }) {
  return (
    <button className={`sb-icon ${active ? 'active' : ''}`} title={title} onClick={onClick}>
      {children}
    </button>
  )
}

export default function App() {
  const [page, setPage]                 = useState('home')
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

  const attendance = useAttendance()
  const team       = useTeam()
  const activity   = useActivity()
  const { log }    = activity

  // ── Logged board ops (UI) ──────────────────────────────────────
  const addCardLogged = useCallback((columnId, title, description = '', due = '') => {
    addCard(columnId, title, description, due)
    log('card', `Card baru: "${title}"`)
  }, [addCard, log])

  const deleteCardLogged = useCallback((cardId) => {
    const card = board.columns.flatMap(c => c.cards).find(c => c.id === cardId)
    deleteCard(cardId)
    log('card', `Card dihapus: "${card?.title || cardId}"`)
  }, [deleteCard, board, log])

  const moveCardLogged = useCallback((cardId, targetColumnId, targetIndex = -1) => {
    const card = board.columns.flatMap(c => c.cards).find(c => c.id === cardId)
    const target = board.columns.find(c => c.id === targetColumnId)
    moveCard(cardId, targetColumnId, targetIndex)
    if (card && target) log('card', `"${card.title}" dipindah ke ${target.title}`)
  }, [moveCard, board, log])

  // ── AI chat ────────────────────────────────────────────────────
  const handleToolCall = useCallback((action) => {
    switch (action.tool) {
      case 'add_card':      addCard(action.columnId, action.title, action.description || '', action.due || ''); log('ai', `AI nambahin card "${action.title}"`); break
      case 'update_card':   updateCard(action.cardId, action.changes || {}); log('ai', 'AI update card'); break
      case 'move_card':     moveCard(action.cardId, action.targetColumnId); log('ai', 'AI mindahin card'); break
      case 'delete_card':   deleteCard(action.cardId); log('ai', 'AI hapus card'); break
      case 'open_card':     setPage('board'); setModalCard({ id: action.cardId }); break
      case 'add_column':    addColumn(action.title); log('ai', `AI nambahin kolom "${action.title}"`); break
      case 'rename_column': renameColumn(action.columnId, action.title); break
      case 'delete_column': deleteColumn(action.columnId); log('ai', 'AI hapus kolom'); break
      case 'navigate_page': {
        const target = action.page === 'activity' ? 'home' : action.page
        if (PAGES.includes(target)) { setPage(target); log('ai', `AI buka halaman ${target}`) }
        break
      }
      case 'clock_in':
        if (attendance.clockIn()) log('absen', 'Clock in via AI — mulai kerja')
        break
      case 'clock_out':
        if (attendance.clockOut()) log('absen', 'Clock out via AI — sesi selesai')
        break
      case 'add_team_member': {
        const m = team.addMember(action.name || 'Anggota', action.role || 'Member', action.salary || 5000000)
        log('team', `AI nambahin anggota: ${m.name} (${m.role})`)
        break
      }
    }
  }, [addCard, updateCard, moveCard, deleteCard, addColumn, renameColumn, deleteColumn, attendance, team, log])

  // App context for the AI (page, absen, team)
  const getAppContext = useCallback(() => ({
    currentPage: page,
    availablePages: PAGES,
    attendance: {
      isClockedIn: attendance.isClockedIn,
      daysPresentThisMonth: attendance.daysPresent,
      hoursThisMonth: fmtDuration(attendance.monthMs),
      streak: attendance.streak,
    },
    team: team.members.map(m => ({ id: m.id, name: m.name, role: m.role, salary: m.salary })),
  }), [page, attendance, team])

  const { messages, loading, sendMessage, stopStream, model, setModel } = useChat({ getBoardSummary, getAppContext, onToolCall: handleToolCall })

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

  // open a card from Search / Calendar pages
  function openCardFromPage(boardId, card) {
    if (boardId !== activeId) switchTab(boardId)
    setPage('board')
    setModalCard(card)
  }

  const PAGE_TITLES = {
    home: 'Home', search: 'Search', board: 'Board', absen: 'Absensi',
    calendar: 'Kalender', team: 'Tim', payroll: 'Payroll', activity: 'Aktivitas',
  }

  return (
    <div className="app">

      {/* ── Sidebar ── */}
      <aside className="sidebar-v2">
        <div className="sb-logo">
          <img src={logo} alt="Logo" />
        </div>
        <div className="sb-icons-top">
          <SidebarIcon title="Home" active={page === 'home'} onClick={() => setPage('home')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Search" active={page === 'search'} onClick={() => setPage('search')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Board" active={page === 'board'} onClick={() => setPage('board')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Absensi" active={page === 'absen'} onClick={() => setPage('absen')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Kalender" active={page === 'calendar'} onClick={() => setPage('calendar')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Tim" active={page === 'team'} onClick={() => setPage('team')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </SidebarIcon>
          <SidebarIcon title="Payroll" active={page === 'payroll'} onClick={() => setPage('payroll')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </SidebarIcon>
        </div>
        <div className="sb-icons-bottom">
          <div className="sb-avatar" title="Anesh — Owner">A</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">

        {/* ── Topbar ── */}
        <header className="topbar-v2">
          {page === 'board' ? (
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
          ) : (
            <div className="topbar-pagetitle">{PAGE_TITLES[page]}</div>
          )}

          <div className="topbar-spacer" />

          {page === 'board' && (
            <>
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
            </>
          )}

          <button className="topbar-btn primary" onClick={() => setChatOpen(v => !v)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            AI Chat
          </button>
        </header>

        {/* ── Filter Bar (board only) ── */}
        {page === 'board' && filterOpen && (
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

        {/* ── Pages ── */}
        {page === 'home' && (
          <HomePage
            boards={boards} board={board} attendance={attendance} team={team} activity={activity}
            onNavigate={setPage} onOpenChat={() => setChatOpen(true)}
          />
        )}
        {page === 'search'   && <SearchPage boards={boards} onOpenCard={openCardFromPage} />}
        {page === 'absen'    && <ClockPage attendance={attendance} onLog={log} />}
        {page === 'calendar' && <CalendarPage boards={boards} onOpenCard={openCardFromPage} />}
        {page === 'team'     && <TeamPage team={team} onLog={log} />}
        {page === 'payroll'  && <PayrollPage team={team} attendance={attendance} />}

        {page === 'board' && (
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
                              onAddCard={addCardLogged} onDeleteCard={deleteCardLogged}
                              onDeleteColumn={deleteColumn} onRenameColumn={renameColumn}
                              onMoveCard={moveCardLogged} onDuplicateCard={duplicateCard}
                              onCardClick={card => setModalCard(card)}
                            />
                          ))}
                        </SortableContext>
                        {newColOpen
                          ? <AddColumnForm onAdd={name => { addColumn(name); log('column', `Kolom baru: "${name}"`); setNewColOpen(false) }} onCancel={() => setNewColOpen(false)} />
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
        )}
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
          onUpdate={updateCard} onDelete={deleteCardLogged}
          onAddComment={addComment} onDeleteComment={deleteComment}
          onMove={moveCardLogged} onDuplicate={duplicateCard}
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
