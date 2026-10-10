import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Importado cedo para capturar beforeinstallprompt antes da renderização
import './lib/pwa'
import './index.css'
import './i18n'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
