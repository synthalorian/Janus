import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Import all theme CSS files
import './themes/synthwave84.css'
import './themes/synthwave-midnight.css'
import './themes/synthwave-dawn.css'
import './themes/dark.css'
import './themes/light.css'
import './themes/cyberpunk.css'
import './themes/fallout-terminal.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)