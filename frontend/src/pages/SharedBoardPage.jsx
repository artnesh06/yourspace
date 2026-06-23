import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, closestCorners, defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanColumn } from '../components/KanbanColumn'
import { KanbanCard } from '../components/KanbanCard'
import { ChatPanel } from '../components/ChatPanel'
import { useChat } from '../hooks/useChat'
import { apiUrl } from '../lib/api'

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
  const [board, setBoard] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [error, setError] = useState('')
  const [activeItem, setActiveItem] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    fetchShared(token)
      .then(data => { setBoard(data.board); setOwnerId(data.owner_id) })
      .catch(e => setError(e.message))
  }, [token])

  // Save debounced
  useEffect(() => {
    if (!board) return
    const t = setTimeout(() => saveShared(token, board), 800)
    return () => clearTimeout(t)
  }, [board, token])

  const getBoardSummary = useCallback(() => board?.columns || [], [board])
  const getAppContext = useCallback(() => ({ currentPage: 'shared-board' }), [])

  // AI per-board (key = token, no user scoping)
  const { messages, loading, sendMessage, stopStream, clearChat, model, setModel } = useChat({
    userId: `shared-${token}`,
    getBoardSummary,
    getAppContext,
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart({ active }) { setActiveItem(active.id) }

  function handleDragEnd({ active, over }) {
    setActiveItem(null)
    if (!over || active.id === over.id || !board) return
    const cols = board.columns
    const isCol = cols.find(c => c.id === active.id)
    if (isCol) {
      const from = cols.findIndex(c => c.id === active.id)
      const to = cols.findIndex(c => c.id === over.id)
      if (from !== to) setBoard(b => ({ ...b, columns: arrayMove(b.columns, from, to) }))
      return
    }
    const fromCol = cols.find(c => c.cards.find(cd => cd.id === active.id))
    const toCol = cols.find(c => c.id === over.id || c.cards.find(cd => cd.id === over.id))
    if (!fromCol || !toCol) return
    if (fromCol.id === toCol.id) {
      const fi = fromCol.cards.findIndex(c => c.id === active.id)
      const ti = fromCol.cards.findIndex(c => c.id === over.id)
      if (fi !== ti) setBoard(b => ({
        ...b,
        columns: b.columns.map(c => c.id === fromCol.id
          ? { ...c, cards: arrayMove(c.cards, fi, ti) } : c)
      }))
    } else {
      const card = fromCol.cards.find(c => c.id === active.id)
      const ti = toCol.cards.findIndex(c => c.id === over.id)
      setBoard(b => ({
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
  const activeCol = activeItem ? board.columns.find(c => c.id === activeItem) : null

  return (
    <div className="app" style={{ flexDirection: 'column' }}>
      <header className="topbar-v2" style={{ padding: '0 16px', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
          🌿 {board.label || 'Shared Board'}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Shared · editable</span>
        <button className="topbar-btn primary" onClick={() => setChatOpen(v => !v)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          AI Chat
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="board-scroll">
            <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
              {board.columns.map(col => (
                <KanbanColumn key={col.id} column={col} allCards={board.columns.flatMap(c => c.cards)} />
              ))}
            </SortableContext>
          </div>
          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
            {activeCard ? <KanbanCard card={activeCard} overlay /> : null}
            {activeCol ? <div style={{ opacity: 0.7, transform: 'rotate(2deg)' }}><KanbanColumn column={activeCol} /></div> : null}
          </DragOverlay>
        </DndContext>

        {chatOpen && (
          <ChatPanel
            messages={messages} loading={loading}
            onSend={sendMessage} onStop={stopStream} onClear={clearChat}
            model={model} onModelChange={setModel}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
