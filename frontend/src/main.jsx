import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import './index.css'
import App from './App.jsx'

const container = document.getElementById('root')
const hasPrerenderedContent = container && container.hasChildNodes() && !container.querySelector('#prerender')

const appElement = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)

if (hasPrerenderedContent) {
  hydrateRoot(container, appElement)
} else if (container) {
  createRoot(container).render(appElement)
}
