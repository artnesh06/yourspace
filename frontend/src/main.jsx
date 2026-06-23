import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SharedBoardPage } from './pages/SharedBoardPage.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

const path = window.location.pathname
const sharedMatch = path.match(/^\/shared\/([A-Za-z0-9_-]+)$/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {sharedMatch
        ? <SharedBoardPage token={sharedMatch[1]} />
        : <App />
      }
    </ErrorBoundary>
  </StrictMode>,
)
