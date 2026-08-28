import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import './index.css'
import App from './App.tsx'
import { useBoardStore } from './store/boardStore'
import { bootWebmcp } from './webmcp/boot'

const rootRoute = createRootRoute({ component: App })
const router = createRouter({ routeTree: rootRoute })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

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
    <RouterProvider router={router} />
  </StrictMode>,
)
