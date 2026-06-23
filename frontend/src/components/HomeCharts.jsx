import { useState, useEffect, useId, useMemo } from 'react'

/* ── shared: smooth monotone path through points ──────────────── */
function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

/* ── Area chart with animated draw-in + hover crosshair ───────── */
export function AreaChart({ data = [], labels = [], height = 170, accent = 'var(--claude-orange)' }) {
  const uid = useId().replace(/:/g, '')
  const [hover, setHover] = useState(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t) }, [])

  const W = 640, H = height, padX = 8, padTop = 16, padBot = 26
  const max = Math.max(1, ...data)
  const stepX = (W - padX * 2) / Math.max(1, data.length - 1)
  const pts = data.map((v, i) => ({
    x: padX + i * stepX,
    y: padTop + (H - padTop - padBot) * (1 - v / max),
    v, i,
  }))

  const line = smoothPath(pts)
  const area = pts.length ? `${line} L ${pts[pts.length - 1].x} ${H - padBot} L ${pts[0].x} ${H - padBot} Z` : ''
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map(f => padTop + (H - padTop - padBot) * f)

  return (
    <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="area-chart" preserveAspectRatio="none"
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * W
          let nearest = 0, dist = Infinity
          pts.forEach(p => { const dd = Math.abs(p.x - x); if (dd < dist) { dist = dd; nearest = p.i } })
          setHover(nearest)
        }}>
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridYs.map((y, i) => (
          <line key={i} x1={padX} y1={y} x2={W - padX} y2={y} className="chart-grid" />
        ))}
        <path d={area} fill={`url(#area-${uid})`} className={`area-fill ${mounted ? 'on' : ''}`} />
        <path d={line} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"
          className={`area-line ${mounted ? 'on' : ''}`} pathLength="1" />
        {hover != null && pts[hover] && (
          <g className="chart-cursor">
            <line x1={pts[hover].x} y1={padTop} x2={pts[hover].x} y2={H - padBot} className="chart-crosshair" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="5" fill={accent} stroke="var(--surface)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover != null && pts[hover] && (
        <div className="chart-tip" style={{ left: `${(pts[hover].x / W) * 100}%` }}>
          <strong>{pts[hover].v}</strong>
          <span>{labels[hover] || ''}</span>
        </div>
      )}
    </div>
  )
}

/* ── Donut chart with animated arcs + center label ────────────── */
export function Donut({ segments = [], size = 168 }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t) }, [])
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = size / 2 - 14
  const c = 2 * Math.PI * r
  let offset = 0
  const arcs = segments.map(seg => {
    const frac = total ? seg.value / total : 0
    const len = frac * c
    const arc = { ...seg, dash: len, gap: c - len, rot: (offset / c) * 360 }
    offset += len
    return arc
  })
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="donut">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--claude-soft)" strokeWidth="13" />
        {arcs.map((a, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={a.color} strokeWidth="13" strokeLinecap="round"
            strokeDasharray={`${mounted ? a.dash : 0} ${c}`}
            transform={`rotate(${-90 + a.rot} ${size / 2} ${size / 2})`}
            style={{ transition: `stroke-dasharray .9s cubic-bezier(.32,.72,.32,1) ${i * 90}ms` }} />
        ))}
      </svg>
      <div className="donut-center">
        <span className="donut-total">{total}</span>
        <span className="donut-label">task</span>
      </div>
    </div>
  )
}

/* ── Activity rings (Apple-watch style concentric) ────────────── */
export function ActivityRings({ rings = [], size = 168 }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 150); return () => clearTimeout(t) }, [])
  const center = size / 2
  const stroke = 13, gap = 5
  return (
    <div className="rings-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rings">
        {rings.map((ring, i) => {
          const r = center - 10 - i * (stroke + gap)
          const c = 2 * Math.PI * r
          const pct = Math.max(0, Math.min(1, ring.value))
          return (
            <g key={i}>
              <circle cx={center} cy={center} r={r} fill="none" stroke={ring.track || 'var(--claude-soft)'} strokeWidth={stroke} />
              <circle cx={center} cy={center} r={r} fill="none" stroke={ring.color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={mounted ? c * (1 - pct) : c}
                transform={`rotate(-90 ${center} ${center})`}
                style={{ transition: `stroke-dashoffset 1.1s cubic-bezier(.32,.72,.32,1) ${i * 120}ms` }} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ── Sparkline (tiny inline area) ─────────────────────────────── */
export function Sparkline({ data = [], width = 96, height = 32, accent = 'var(--claude-orange)' }) {
  const uid = useId().replace(/:/g, '')
  const max = Math.max(1, ...data)
  const min = Math.min(0, ...data)
  const stepX = width / Math.max(1, data.length - 1)
  const pts = data.map((v, i) => ({
    x: i * stepX,
    y: height - 3 - (height - 6) * ((v - min) / Math.max(1, max - min)),
  }))
  const line = smoothPath(pts)
  const area = pts.length ? `${line} L ${width} ${height} L 0 ${height} Z` : ''
  return (
    <svg width={width} height={height} className="sparkline" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${uid})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Bar chart (animated, highlight last) ─────────────────────── */
export function BarChart({ data = [], labels = [], height = 150, accent = 'var(--claude-orange)', fmt = (v) => v }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])
  const max = Math.max(1, ...data)
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((v, i) => {
        const isLast = i === data.length - 1
        const pct = (v / max) * 100
        return (
          <div key={i} className="bar-col">
            <span className="bar-val">{v > 0 ? fmt(v) : ''}</span>
            <div className="bar-track">
              <div className={`bar-fill ${isLast ? 'today' : ''}`}
                style={{ height: mounted ? `${Math.max(3, pct)}%` : '0%', transitionDelay: `${i * 60}ms`, background: isLast ? accent : undefined }} />
            </div>
            <span className={`bar-label ${isLast ? 'today' : ''}`}>{labels[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Radial gauge (single value %) ────────────────────────────── */
export function Gauge({ value = 0, size = 64, accent, label }) {
  const [anim, setAnim] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAnim(value), 150); return () => clearTimeout(t) }, [value])
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const uid = useId()
  // default: gradasi tema (terkunci ke --blue-grad-from / --blue-grad-to)
  const stroke = accent ?? `url(#gauge-${uid})`
  return (
    <svg width={size} height={size} className="gauge">
      <defs>
        <linearGradient id={`gauge-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--blue-grad-from)" />
          <stop offset="100%" stopColor="var(--blue-grad-to)" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--claude-soft)" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - anim / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.32,.72,.32,1)' }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="gauge-label">
        {label ?? `${value}%`}
      </text>
    </svg>
  )
}
