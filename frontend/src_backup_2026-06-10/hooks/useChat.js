import { useState, useCallback, useRef } from 'react'

export function useChat({ getBoardSummary, onToolCall }) {
  const [messages, setMessages] = useState([
    {
      id: 'm0',
      role: 'assistant',
      content: "Halo! Gue AI assistant lo. Tanya apapun soal board, atau suruh gue tambah / pindah card.",
      ts: Date.now(),
    },
  ])
  const [loading, setLoading]   = useState(false)
  const [model, setModel]       = useState('llama-3.3-70b-versatile')
  const historyRef              = useRef([])
  const abortRef                = useRef(null)

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

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: userText,
          model,
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
              // Just update UI with tool event badge, don't apply yet
              // Tool actions will be applied once in the 'done' event
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
                  toolEvents: tool_actions || m.toolEvents || [],
                } : m
              ))
              historyRef.current = [...historyRef.current, { role: 'assistant', content: full_text || fullText }]

              // Apply tool actions ONCE here only
              if (tool_actions?.length) {
                tool_actions.forEach(ta => {
                  if (ta.result?.action) onToolCall({ tool: ta.result.action, ...ta.result })
                })
              }
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

  return { messages, loading, sendMessage, stopStream, model, setModel }
}
