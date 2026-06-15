import { useCallback } from 'react'
import { useServerState } from './useServerState'

const COLOR_CYCLE = ['blue', 'yellow', 'green', 'pink', 'purple']
export function cardColor(index) {
  return COLOR_CYCLE[index % COLOR_CYCLE.length]
}

function genId() {
  return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function makeDefaultBoard(label) {
  return {
    id: genId(),
    label,
    columns: [
      {
        id: 'idea', title: 'Idea',
        cards: [
          { id: 'k1', title: 'Kolaborasi Brand Lokal', description: 'Explore partnership dengan brand fashion lokal.', due: '15 Apr', comments: [], images: [], coverId: null },
          { id: 'k2', title: 'Campaign Lebaran 2025', description: 'Konsep visual dan copy untuk campaign Ramadan & Lebaran.', due: '10 Apr', comments: [], images: [], coverId: null },
        ],
      },
      {
        id: 'on-progress', title: 'On Progress',
        cards: [
          { id: 'k3', title: 'Reels Series — Behind the Scene', description: 'Short video series 3 episode untuk Instagram Reels.', due: '20 Apr', comments: [], images: [], coverId: null },
        ],
      },
      { id: 'review', title: 'Review', cards: [] },
      {
        id: 'done', title: 'Done',
        cards: [
          { id: 'k5', title: 'Konten Feed IG April', description: 'Grid layout 9 post untuk bulan April sudah selesai.', due: '1 Apr', comments: [], images: [], coverId: null, posted: true },
        ],
      },
    ],
  }
}

const STORAGE_KEY = 'yourspace-multiboad-v1'

function defaultState() {
  const defaultBoard = makeDefaultBoard('Board 1')
  return { boards: [defaultBoard], activeId: defaultBoard.id }
}

export function useMultiBoard() {
  const [state, setState, { loading }] = useServerState('boards', defaultState(), STORAGE_KEY)

  const update = useCallback((fn) => {
    setState(prev => {
      // guard: data server bisa kosong/aneh
      if (!prev?.boards?.length) prev = defaultState()
      return fn(prev)
    })
  }, [setState])

  // normalisasi: data server yang nggak lengkap nggak boleh bikin crash
  const safeBoards = (state?.boards?.length ? state.boards : defaultState().boards)
    .map(b => ({
      ...b,
      label: b.label || 'Board',
      columns: Array.isArray(b.columns)
        ? b.columns.map(c => ({ ...c, cards: Array.isArray(c.cards) ? c.cards : [] }))
        : [],
    }))
  const activeBoard = safeBoards.find(b => b.id === state?.activeId) || safeBoards[0]
  const board = { columns: activeBoard.columns }

  // ── Tab operations ──
  const addTab = useCallback((label) => {
    const newBoard = makeDefaultBoard(label)
    update(prev => ({
      ...prev,
      boards: [...prev.boards, newBoard],
      activeId: newBoard.id,
    }))
  }, [update])

  const switchTab = useCallback((id) => {
    update(prev => ({ ...prev, activeId: id }))
  }, [update])

  const renameTab = useCallback((id, label) => {
    update(prev => ({
      ...prev,
      boards: prev.boards.map(b => b.id === id ? { ...b, label } : b),
    }))
  }, [update])

  const deleteTab = useCallback((id) => {
    update(prev => {
      const boards = prev.boards.filter(b => b.id !== id)
      if (boards.length === 0) {
        const nb = makeDefaultBoard('Board 1')
        return { boards: [nb], activeId: nb.id }
      }
      const activeId = prev.activeId === id ? boards[0].id : prev.activeId
      return { ...prev, boards, activeId }
    })
  }, [update])

  // ── Column operations (on active board) ──
  const updateActive = useCallback((fn) => {
    update(prev => ({
      ...prev,
      boards: prev.boards.map(b =>
        b.id === prev.activeId ? { ...b, columns: fn(b.columns) } : b
      ),
    }))
  }, [update])

  const setColumns = useCallback((columnsOrFn) => {
    update(prev => ({
      ...prev,
      boards: prev.boards.map(b => {
        if (b.id !== prev.activeId) return b
        const columns = typeof columnsOrFn === 'function' ? columnsOrFn(b.columns) : columnsOrFn
        return { ...b, columns }
      }),
    }))
  }, [update])

  const addCard = useCallback((columnId, title, description = '', due = '') => {
    updateActive(cols => cols.map(col =>
      col.id === columnId
        ? { ...col, cards: [{ id: genId(), title, description, due, comments: [], images: [], coverId: null, posted: false }, ...col.cards] }
        : col
    ))
  }, [updateActive])

  const updateCard = useCallback((cardId, changes) => {
    updateActive(cols => cols.map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === cardId ? { ...c, ...changes } : c),
    })))
  }, [updateActive])

  const deleteCard = useCallback((cardId, fallbackTitle = '') => {
    updateActive(cols => {
      // Normal path: hapus by id
      const idExists = cols.some(col => col.cards.some(c => c.id === cardId))
      if (idExists) {
        return cols.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== cardId) }))
      }
      // Fallback: id nggak ketemu (mis. AI ngasih id ngawur/stale) → match by title
      const target = (fallbackTitle || '').trim().toLowerCase()
      if (!target) return cols
      let removed = false
      return cols.map(col => ({
        ...col,
        cards: col.cards.filter(c => {
          if (removed) return true
          if ((c.title || '').trim().toLowerCase() === target) { removed = true; return false }
          return true
        }),
      }))
    })
  }, [updateActive])

  const moveCard = useCallback((cardId, targetColumnId, targetIndex = -1) => {
    updateActive(cols => {
      let movedCard = null
      const cleaned = cols.map(col => {
        const found = col.cards.find(c => c.id === cardId)
        if (found) movedCard = found
        return { ...col, cards: col.cards.filter(c => c.id !== cardId) }
      })
      if (!movedCard) return cols
      return cleaned.map(col => {
        if (col.id !== targetColumnId) return col
        const cards = [...col.cards]
        if (targetIndex >= 0) cards.splice(targetIndex, 0, movedCard)
        else cards.push(movedCard)
        return { ...col, cards }
      })
    })
  }, [updateActive])

  const duplicateCard = useCallback((cardId) => {
    updateActive(cols => cols.map(col => {
      const idx = col.cards.findIndex(c => c.id === cardId)
      if (idx === -1) return col
      const orig = col.cards[idx]
      const copy = { ...orig, id: genId(), title: orig.title + ' (copy)', comments: [], images: [], coverId: null }
      const cards = [...col.cards]
      cards.splice(idx + 1, 0, copy)
      return { ...col, cards }
    }))
  }, [updateActive])

  const addColumn = useCallback((title) => {
    updateActive(cols => [...cols, { id: genId(), title, cards: [] }])
  }, [updateActive])

  const renameColumn = useCallback((columnId, title) => {
    updateActive(cols => cols.map(col => col.id === columnId ? { ...col, title } : col))
  }, [updateActive])

  const deleteColumn = useCallback((columnId) => {
    updateActive(cols => cols.filter(col => col.id !== columnId))
  }, [updateActive])

  const addComment = useCallback((cardId, text) => {
    updateActive(cols => cols.map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === cardId
        ? { ...c, comments: [...(c.comments || []), { id: genId(), text, createdAt: new Date().toISOString() }] }
        : c
      ),
    })))
  }, [updateActive])

  const deleteComment = useCallback((cardId, commentId) => {
    updateActive(cols => cols.map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === cardId
        ? { ...c, comments: (c.comments || []).filter(cm => cm.id !== commentId) }
        : c
      ),
    })))
  }, [updateActive])

  const addChecklistItem = useCallback((cardId, text) => {
    updateActive(cols => cols.map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === cardId
        ? { ...c, checklist: [...(c.checklist || []), { id: genId(), text, done: false }] }
        : c
      ),
    })))
  }, [updateActive])

  const toggleChecklistItem = useCallback((cardId, itemText) => {
    const target = (itemText || '').trim().toLowerCase()
    updateActive(cols => cols.map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === cardId
        ? { ...c, checklist: (c.checklist || []).map(it =>
            (it.text || '').trim().toLowerCase() === target ? { ...it, done: !it.done } : it
          ) }
        : c
      ),
    })))
  }, [updateActive])

  const getBoardSummary = useCallback(() => {
    return activeBoard.columns.map(col => ({
      id: col.id, title: col.title, cardCount: col.cards.length,
      cards: col.cards.map(c => ({
        id: c.id, title: c.title,
        description: (c.description || '').slice(0, 120) || undefined,
        due: c.due || undefined,
        color: c.color || undefined,
        done: c.posted || undefined,
        checklist: (c.checklist || []).length
          ? c.checklist.map(it => ({ text: it.text, done: !!it.done }))
          : undefined,
        commentCount: (c.comments || []).length || undefined,
      })),
    }))
  }, [activeBoard])

  // Ringkasan SEMUA board (buat AI search lintas board)
  const getAllBoardsSummary = useCallback(() => {
    return safeBoards.map(b => ({
      id: b.id, label: b.label || b.name || 'Board',
      cards: (b.columns || []).flatMap(col =>
        (col.cards || []).map(c => ({ title: c.title, column: col.title, due: c.due || undefined }))
      ),
    }))
  }, [safeBoards])

  return {
    board,
    boards: safeBoards,
    activeId: activeBoard.id,
    boardsLoading: loading,
    addTab, switchTab, renameTab, deleteTab,
    addCard, updateCard, deleteCard, duplicateCard, moveCard, setColumns,
    addColumn, renameColumn, deleteColumn,
    addComment, deleteComment, addChecklistItem, toggleChecklistItem,
    getBoardSummary, getAllBoardsSummary,
  }
}

// keep old export alias for compatibility
export { useMultiBoard as useBoard }
