import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { useEventStream } from '@/api/events'
// Each feature registers what its events do to the cache on load.
import '@/api/library'
import { Components } from '@/pages/components'
import { Home } from '@/pages/home'
import { Settings } from '@/pages/settings'
import { Workspace } from '@/pages/workspace'

export default function App() {
  useEventStream()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/books/:id" element={<Workspace />} />
        {/* Home's due list lands straight in a set's walkthrough. */}
        <Route path="/books/:id/homework/:homework" element={<Workspace />} />
        <Route path="/settings" element={<Settings />} />
        {/* Not in the nav: the page you open to see what a change did. */}
        <Route path="/components" element={<Components />} />
      </Routes>
    </BrowserRouter>
  )
}
