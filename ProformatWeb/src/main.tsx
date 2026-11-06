import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { applyTheme } from './lib/theme'
import { registerServiceWorker } from './lib/install'

try {
  applyTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light')
} catch {
  applyTheme('light')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
