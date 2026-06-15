import { useState, useCallback, useRef, useEffect } from 'react'
import { apiUrl } from '../lib/api'

const STORAGE_KEY = 'ys-chat-v1'

const GREETING = {
  id: 'm0',
  role: 'assistant',
  content: "Halo! Gue AI assistant lo. Tanya apapun soal board, atau suruh gue tambah / pindah card.",
  ts: Date.now(),
}

// Buang reminder assistant yang kontennya kembar (efek bug lama: reminder
// ke-append tiap reload sampai numpuk). Sisain kemunculan pertama aja.
function dedupeMessages(msgs) {
  const seen = new Set()
  return msgs.filter(m => {
    const isReminder = m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('⏰ Reminder!')
    if (!isReminder) return true
    if (seen.has(m.content)) return false
    seen.add(m.content)
    return true
  })
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      return { ...data, messages: dedupeMessages(data.messages) }
    }
  } catch { /* corrupt storage — start fresh */ }
  return null
}

export function useChat({ userId = 'default', getBoardSummary, getAppContext, onToolCall }) {
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

  const sendMessage = useCallback(async (userText, image = null) => {
    if ((!userText.trim() && !image) || loading) return

    const userMsg = { id: 'm' + Date.now(), role: 'user', content: userText, image: image || undefined, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    // Placeholder for streaming assistant message
    const assistantId = 'ma' + Date.now()
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', streaming: true,
      ts: Date.now(), tokens: null, elapsed: null, toolEvents: [],
    }])

    const boardSummary = getBoardSummary()
    // Catatan: gambar cuma dilampirkan/disimpan, AI nggak baca isinya
    const textForAI = userText.trim() || '(user melampirkan sebuah gambar)'
    historyRef.current = [...historyRef.current, { role: 'user', content: textForAI }]

    try {
      abortRef.current = new AbortController()

      const res = await fetch(apiUrl('/api/chat/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: textForAI,
          model,
          user_id: userId,
          chat_history: historyRef.current.slice(-20),
          board_data: { columns: boardSummary, app: getAppContext ? getAppContext() : undefined },
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
      // "Failed to fetch" = network/koneksi gagal (backend mati / gak kejangkau).
      // Kasih pesan yang jelas, bukan istilah teknis.
      const isNetwork = err.message === 'Failed to fetch' || err.name === 'TypeError'
      const friendly = isNetwork
        ? '⚠️ Gak bisa nyambung ke server AI. Pastiin backend (port 8000) lagi jalan, terus coba lagi.'
        : `⚠️ Error: ${err.message}`
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: friendly, streaming: false }
          : m
      ))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [loading, model, getBoardSummary, getAppContext, onToolCall])

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

  // pesan assistant lokal (tanpa hit API) — dipakai buat reminder deadline.
  // Dedupe: kalau pesan dengan konten sama udah ada (mis. ke-restore dari
  // localStorage lalu effect jalan lagi pas reload), jangan tambah lagi.
  const addLocalAssistant = useCallback((content) => {
    setMessages(prev => {
      if (prev.some(m => m.role === 'assistant' && m.content === content)) return prev
      historyRef.current = [...historyRef.current, { role: 'assistant', content }]
      return [...prev, { id: 'mr' + Date.now(), role: 'assistant', content, ts: Date.now() }]
    })
  }, [])

  return { messages, loading, sendMessage, stopStream, clearChat, addLocalAssistant, model, setModel }
}
