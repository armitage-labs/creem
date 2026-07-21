import { StrictMode } from 'react'
import '@framer/plugin/framer.css'
import '@/App.css'
import ReactDOM from 'react-dom/client'
import { App } from '@/App.tsx'

const root = document.getElementById('root')

if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
