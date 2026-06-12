import { useCallback } from 'react'
import { useServerState } from './useServerState'

const STORAGE_KEY = 'ys-team-v1'

const AVATAR_COLORS = ['#C96442', '#3563C4', '#197A43', '#6A4FC0', '#9C7A1D', '#C2492C']

function genId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function defaultTeam() {
  return {
    members: [
      { id: 'anesh', name: 'Anesh', role: 'Owner', salary: 12000000, color: '#C96442', joined: '2025-01-01' },
    ],
  }
}

export function fmtIDR(n) {
  return 'Rp ' + (n || 0).toLocaleString('id-ID')
}

export function useTeam() {
  const [state, setState] = useServerState('team', defaultTeam(), STORAGE_KEY)
  const members_ = state?.members?.length ? state.members : defaultTeam().members

  const addMember = useCallback((name, role = 'Member', salary = 5000000) => {
    const member = {
      id: genId(),
      name: name.trim(),
      role: role.trim() || 'Member',
      salary: Number(salary) || 0,
      color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      joined: new Date().toISOString().slice(0, 10),
    }
    setState(prev => ({ members: [...(prev?.members || []), member] }))
    return member
  }, [])

  const updateMember = useCallback((id, changes) => {
    setState(prev => ({
      members: (prev?.members || []).map(m => m.id === id ? { ...m, ...changes } : m),
    }))
  }, [])

  const removeMember = useCallback((id) => {
    setState(prev => ({ members: (prev?.members || []).filter(m => m.id !== id) }))
  }, [])

  return { members: members_, addMember, updateMember, removeMember }
}
