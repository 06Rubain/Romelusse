import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme } from './lib/theme'

try {
  applyTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light')
} catch {
  applyTheme('light')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
