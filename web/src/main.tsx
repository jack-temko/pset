import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { followSystem } from './lib/theme'
import { queryClient } from './api/query'

followSystem()

// Every font starts loading now, not when something first uses it: a font
// that arrives after first paint reflows what is already on screen (the first
// table in JetBrains Mono did). The sample has a letter from each subset the
// stylesheets split a family into, so each file is fetched. Not awaited.
for (const family of ['Inter Variable', 'Newsreader Variable', 'JetBrains Mono Variable']) {
  void document.fonts.load(`1em "${family}"`, 'AaĀЖѠΩẠ').catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
