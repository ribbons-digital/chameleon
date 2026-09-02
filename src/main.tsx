import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useBoardStore } from './store/boardStore'
import { bootWebmcp } from './webmcp/boot'

function bootAfterHydration() {
  const persistApi = useBoardStore.persist
  const start = () => {
    void bootWebmcp()
  }
  if (persistApi.hasHydrated()) {
    start()
    return
  }
  persistApi.onFinishHydration(start)
}

bootAfterHydration()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
