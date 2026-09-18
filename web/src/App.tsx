import { BrowserRouter, Route, Routes } from 'react-router-dom'

/** Placeholder while the frontend is rebuilt page by page on `overhaul`.
 *  The first unit — the shell and the Home dashboard — replaces this. */
function Rebuilding() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-page text-center">
      <p className="font-heading text-4xl">Rebuilding.</p>
      <p className="font-heading text-lg text-muted-foreground italic">
        The shell and the dashboard land first.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Rebuilding />} />
      </Routes>
    </BrowserRouter>
  )
}
