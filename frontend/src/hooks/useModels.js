import { useState, useEffect } from 'react'

export function useModels() {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/chat/models')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setGroups(data.models || [])
      } catch (e) {
        setError(e.message)
        // Fallback
        setGroups([
          { provider: 'Meta (Llama)', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192'] },
          { provider: 'Google (Gemma)', models: ['gemma2-9b-it'] },
          { provider: 'Mistral', models: ['mixtral-8x7b-32768'] },
        ])
      } finally {
        setLoading(false)
      }
    }
    fetchModels()
  }, [])

  return { groups, loading, error }
}
