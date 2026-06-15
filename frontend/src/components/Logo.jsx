import { useState, useEffect } from 'react'
import logoPng from '../assets/logo.png'
import logoGif from '../assets/logo.gif'

export default function Logo({ className = '', alt = 'Your Space logo' }) {
  const [src, setSrc] = useState(logoPng)

  useEffect(() => {
    // preload gif to avoid flicker on first hover
    const img = new Image()
    img.src = logoGif
  }, [])

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onMouseEnter={() => setSrc(logoGif)}
      onMouseLeave={() => setSrc(logoPng)}
      draggable={false}
    />
  )
}
