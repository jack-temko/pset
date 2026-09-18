import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { Ask } from '@/pages/ask'
import { BookDetail } from '@/pages/book-detail'
import { Doctor } from '@/pages/doctor'
import { Homework } from '@/pages/homework'
import { HomeworkWorkspace } from '@/pages/homework-workspace'
import { Library } from '@/pages/library'
import { NotFound } from '@/pages/not-found'
import { Reader } from '@/pages/reader'
import { Settings } from '@/pages/settings'
import { Tasks } from '@/pages/tasks'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Library />} />
          <Route path="library" element={<Navigate to="/" replace />} />
          <Route path="library/:bookId" element={<BookDetail />} />
          <Route path="library/:bookId/read" element={<Reader />} />
          <Route path="import" element={<Navigate to="/" replace />} />
          <Route path="homework" element={<Homework />} />
          <Route path="homework/:homeworkId" element={<HomeworkWorkspace />} />
          <Route path="ask" element={<Ask />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="doctor" element={<Doctor />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
