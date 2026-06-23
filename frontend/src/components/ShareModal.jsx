import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

const BASE_URL = window.location.origin

export function ShareModal({ boardId, onClose }) {
  const [token, setToken] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    apiFetch(`/api/share/board/${boardId}`)
      .then(res => { setToken(res.token); setEnabled(res.enabled) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boardId])

  async function toggle() {
    setLoading(true)
    try {
      if (enabled) {
        const res = await apiFetch(`/api/share/board/${boardId}`, { method: 'DELETE' })
        setToken(null); setEnabled(false)
      } else {
        const res = await apiFetch(`/api/share/board/${boardId}`, { method: 'POST' })
        setToken(res.token); setEnabled(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    const link = `${BASE_URL}/shared/${token}`
    await navigator.clipboard.writeText(link)
    setCopying(true)
    setTimeout(() => setCopying(false), 1500)
  }

  const shareLink = token ? `${BASE_URL}/shared/${token}` : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box share-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share Board</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="share-modal-body">
          <div className="share-toggle-row">
            <div>
              <p className="share-toggle-label">Share via link</p>
              <p className="share-toggle-sub">Siapapun dengan link bisa lihat & edit board ini</p>
            </div>
            <button
              className={`share-toggle-btn ${enabled ? 'on' : 'off'}`}
              onClick={toggle}
              disabled={loading}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {enabled && token && (
            <div className="share-link-row">
              <input className="share-link-input" readOnly value={shareLink} />
              <button className="share-copy-btn" onClick={copy}>
                {copying ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {enabled && (
            <p className="share-note">
              AI chat tersedia di halaman shared — semua visitor share AI conversation yang sama di board ini.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
