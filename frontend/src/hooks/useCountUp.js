import { useEffect, useRef, useState } from 'react'

// Animated count-up: angka naik smooth tiap target berubah
export function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const from = prevRef.current
    if (from === target) return
    const start = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(from + (target - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else prevRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return val
}
