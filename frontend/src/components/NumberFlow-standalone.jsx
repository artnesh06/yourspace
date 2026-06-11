import { useEffect, useState } from 'react'

/* Continuous Rolling Digits — standalone NumberFlow
   <NumberFlow value={72} />
   <NumberFlow value={price} format={fmtIDR} className="text-xl" /> */

function Digit({ char }) {
  const [state, setState] = useState({ prev: char, curr: char, dir: null, key: 0 })

  useEffect(() => {
    setState(s => {
      if (s.curr === char) return s
      const bothNum = /\d/.test(s.curr) && /\d/.test(char)
      const dir = bothNum && Number(char) < Number(s.curr) ? 'down' : 'up'
      return { prev: s.curr, curr: char, dir, key: s.key + 1 }
    })
  }, [char])

  if (!state.dir) {
    return <span className="nf-slot"><span className="nf-char">{state.curr}</span></span>
  }

  // up: digit lama di atas, baru di bawah, roll 0 → -50%
  // down: digit baru di atas, lama di bawah, roll -50% → 0
  const [top, bottom] = state.dir === 'up'
    ? [state.prev, state.curr]
    : [state.curr, state.prev]

  return (
    <span className="nf-slot">
      <span key={state.key} className={`nf-roll nf-${state.dir}`}>
        <span className="nf-char">{top}</span>
        <span className="nf-char">{bottom}</span>
      </span>
    </span>
  )
}

export default function NumberFlow({ value, format, className = '' }) {
  const str = format ? format(value) : String(value)
  const chars = str.split('')
  const n = chars.length

  return (
    <span className={`nf-root ${className}`}>
      {chars.map((ch, i) =>
        /\d/.test(ch)
          // key dihitung dari kanan biar digit tetap "miliknya" pas jumlah digit berubah
          ? <Digit key={`d${n - i}`} char={ch} />
          : <span key={`s${n - i}-${ch}`} className="nf-char nf-static">{ch}</span>
      )}
    </span>
  )
}
