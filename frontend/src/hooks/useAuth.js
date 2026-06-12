import { useState, useEffect, useCallback } from 'react'
import { apiFetch, getToken, setToken } from '../lib/api'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(!!getToken())

  // validasi token saat app dibuka
  useEffect(() => {
    if (!getToken()) return
    apiFetch('/api/auth/me')
      .then(res => setUser(res.user))
      .catch(() => setToken(''))
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (name, email, password) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    setToken('')
    setUser(null)
  }, [])

  return { user, checking, login, register, logout }
}
