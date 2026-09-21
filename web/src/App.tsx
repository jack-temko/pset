import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Components } from '@/pages/components'
import { Home } from '@/pages/home'
import { Settings } from '@/pages/settings'
import { Workspace } from '@/pages/workspace'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/books/:sha" element={<Workspace />} />
        <Route path="/settings" element={<Settings />} />
        {/* Not in the nav: the page you open to see what a change did. */}
        <Route path="/components" element={<Components />} />
      </Routes>
    </BrowserRouter>
  )
}
