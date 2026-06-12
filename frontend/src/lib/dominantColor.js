// Ambil warna dominan dari gambar (sampling via canvas, di-cache per URL)
const cache = new Map()

export function dominantColor(url) {
  if (cache.has(url)) return cache.get(url)
  const promise = new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const S = 24
        const canvas = document.createElement('canvas')
        canvas.width = S; canvas.height = S
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, S, S)
        const data = ctx.getImageData(0, 0, S, S).data
        const counts = {}
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          // quantize 4 bit per channel biar warna mirip ke-grup
          const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
          counts[key] = (counts[key] || 0) + 1
        }
        let best = 0, bestKey = 0
        for (const k in counts) {
          if (counts[k] > best) { best = counts[k]; bestKey = +k }
        }
        const r = ((bestKey >> 8) & 15) * 17
        const g = ((bestKey >> 4) & 15) * 17
        const b = (bestKey & 15) * 17
        resolve(`rgb(${r}, ${g}, ${b})`)
      } catch {
        resolve('#ECEAE2')
      }
    }
    img.onerror = () => resolve('#ECEAE2')
    img.src = url
  })
  cache.set(url, promise)
  return promise
}
