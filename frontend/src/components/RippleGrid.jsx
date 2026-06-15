import './RippleGrid.css'

export function RippleGrid() {
  const rows = 8
  const columns = 12
  const cells = Array.from({ length: rows * columns }, (_, index) => index)

  return (
    <div className="ripple-grid" aria-hidden="true">
      {cells.map((index) => (
        <span
          key={index}
          className="ripple-cell"
          style={{
            animationDelay: `${(index % columns) * 0.12 + Math.floor(index / columns) * 0.05}s`,
          }}
        />
      ))}
    </div>
  )
}
