import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'grid', placeItems: 'center', height: '100svh',
          background: '#FAF9F5', fontFamily: 'Inter, sans-serif', padding: 20,
        }}>
          <div style={{
            maxWidth: 560, background: '#fff', border: '1px solid #E8E6DD',
            borderRadius: 18, padding: '28px 30px', boxShadow: '0 12px 40px rgba(20,20,19,.08)',
          }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>😵 Ada yang error</h2>
            <p style={{ fontSize: 13.5, color: '#6B6860', marginBottom: 14 }}>
              Aplikasi nabrak sesuatu. Coba reload — kalau masih, kirim pesan error di bawah ini.
            </p>
            <pre style={{
              fontSize: 11.5, background: '#FBE5E0', color: '#B3301B',
              borderRadius: 10, padding: '12px 14px', whiteSpace: 'pre-wrap',
              maxHeight: 220, overflow: 'auto',
            }}>{String(this.state.error?.stack || this.state.error)}</pre>
            <button
              onClick={() => location.reload()}
              style={{
                marginTop: 14, padding: '10px 22px', borderRadius: 10, border: 'none',
                background: '#C96442', color: '#FFF8F2', fontWeight: 700, cursor: 'pointer',
              }}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
