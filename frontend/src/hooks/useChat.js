import { useState, useCallback, useRef, useEffect } from 'react'
import { apiUrl } from '../lib/api'

const STORAGE_KEY = 'ys-chat-v1'
const USER_ID = 'anesh'

const GREETING = {
  id: 'm0',
  role: 'assistant',
  content: "Halo! Gue AI assistant lo. Tanya apapun soal board, atau suruh gue tambah / pindah card.",
  ts: Date.now(),
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Array.isArray(data.messages) && data.messages.length > 0) return data
  } catch { /* corrupt storage — start fresh */ }
  return null
}

export function useChat({ getBoardSummary, onToolCall }) {
  const stored = loadStored()
  const [messages, setMessages] = useState(stored?.messages || [GREETING])
  const [loading, setLoading]   = useState(false)
  const [model, setModel]       = useState(stored?.model || 'claude-haiku-4-5')
  const historyRef              = useRef(stored?.history || [])
  const abortRef                = useRef(null)

  // Persist chat (skip streaming placeholders, cap size)
  useEffect(() => {
    try {
      const toSave = messages.filter(m => !m.streaming).slice(-60)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages: toSave,
        history: historyRef.current.slice(-40),
        model,
      }))
    } catch { /* storage full — ignore */ }
  }, [messages, model])

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || loading) return

    const userMsg = { id: 'm' + Date.now(), role: 'user', content: userText, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Placeholder for streaming assistant message
    const assistantId = 'ma' + Date.now()
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', streaming: true,
      ts: Date.now(), tokens: null, elapsed: null, toolEvents: [],
    }])

    const boardSummary = getBoardSummary()
    historyRef.current = [...historyRef.current, { role: 'user', content: userText }]

    try {
      abortRef.current = new AbortController()

      const res = await fetch(apiUrl('/api/chat/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: userText,
          model,
          user_id: USER_ID,
          chat_history: historyRef.current.slice(-20),
          board_data: { columns: boardSummary },
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event = JSON.parse(raw)

            if (event.type === 'token') {
              fullText += event.token
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullText } : m
              ))
            } else if (event.type === 'tool') {
              // Apply board mutations live as the agent works
              if (event.result?.action) {
                onToolCall({ tool: event.result.action, ...event.result })
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, toolEvents: [...(m.toolEvents || []), event] }
                  : m
              ))
            } else if (event.type === 'done') {
              const { full_text, input_tokens, output_tokens, elapsed, tool_actions } = event
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? {
                  ...m,
                  content: full_text || fullText,
                  streaming: false,
                  tokens: { input: input_tokens, output: output_tokens },
                  elapsed,
                  toolEvents: m.toolEvents || [],
                } : m
              ))
              historyRef.current = [...historyRef.current, { role: 'assistant', content: full_text || fullText }]
            } else if (event.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: `⚠️ ${event.error}`, streaming: false } : m
              ))
            }
          } catch (_) { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `⚠️ Error: ${err.message}`, streaming: false }
          : m
      ))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [loading, model, getBoardSummary, onToolCall])

  const stopStream = useCallback(() => {
    abortRef.current?.abort()
    setLoading(false)
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m))
  }, [])

  const clearChat = useCallback(() => {
    historyRef.current = []
    setMessages([GREETING])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  return { messages, loading, sendMessage, stopStream, clearChat, model, setModel }
}
