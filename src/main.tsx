import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { BASE_URL } from './config/env'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      basename={BASE_URL}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
)
