import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { Doctor } from './index'
import { api } from '@/lib/api'
import type { DoctorCheck, DoctorReport } from '@/lib/types'

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

function check(name: string, status: DoctorCheck['status'], findings: DoctorCheck['findings'] = [
  { severity: 'info', message: 'connected' },
]): DoctorCheck {
  return { name, status, findings }
}

const healthy: DoctorReport = {
  ok: true,
  checks: [
    check('data dir', 'ok', [{ severity: 'info', message: '/home/you/.pset is writable' }]),
    check('database', 'ok', [{ severity: 'info', message: 'schema v1 at /home/you/.pset/pset.db' }]),
    check('poppler', 'ok', [{ severity: 'info', message: 'pdfinfo at /usr/bin/pdfinfo' }]),
    check('tesseract', 'ok', [{ severity: 'info', message: 'tesseract at /usr/bin/tesseract' }]),
    check('chat api', 'ok'),
    check('semantic search', 'ok', [{ severity: 'info', message: 'connected, model nomic-embed-text' }]),
  ],
}

const withFailures: DoctorReport = {
  ok: false,
  checks: [
    check('data dir', 'ok', [{ severity: 'info', message: '/home/you/.pset is writable' }]),
    check('database', 'ok', [{ severity: 'info', message: 'schema v1' }]),
    check('poppler', 'ok', [{ severity: 'info', message: 'pdfinfo at /usr/bin/pdfinfo' }]),
    check('tesseract', 'warn', [
      { severity: 'warning', message: 'missing tesseract — required to read scanned books' },
    ]),
    check('chat api', 'failed', [
      {
        severity: 'error',
        message: 'no chat endpoint or API key configured',
        link: { label: 'Add a key in Settings', href: '/settings' },
      },
    ]),
    check('semantic search', 'failed', [
      {
        severity: 'error',
        message: 'connection refused',
        link: { label: 'Check it in Settings', href: '/settings' },
      },
    ]),
  ],
}

function renderDoctor() {
  return render(
    <MemoryRouter>
      <Doctor />
    </MemoryRouter>,
  )
}

describe('Doctor page', () => {
  it('renders the banner and one row per check', async () => {
    vi.spyOn(api, 'doctor').mockResolvedValue(healthy)
    vi.spyOn(api, 'doctorFix').mockResolvedValue(healthy)
    renderDoctor()

    await waitFor(() => expect(screen.getByText('All checks passed')).toBeTruthy())
    expect(screen.getByText('6 checks')).toBeTruthy()
    expect(screen.getByText('chat api')).toBeTruthy()
    expect(screen.getByText('semantic search')).toBeTruthy()
  })

  it('marks attention and renders finding links to their fix', async () => {
    vi.spyOn(api, 'doctor').mockResolvedValue(withFailures)
    vi.spyOn(api, 'doctorFix').mockResolvedValue(withFailures)
    renderDoctor()

    await waitFor(() => expect(screen.getByText('Needs attention')).toBeTruthy())
    expect(screen.getByText('6 checks · 1 warning · 2 failed')).toBeTruthy()
    const link = screen.getByText('Add a key in Settings') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/settings')
    expect(screen.getByText('Check it in Settings')).toBeTruthy()
  })

  it('Repair runs the fixing pass and shows the fresh report', async () => {
    vi.spyOn(api, 'doctor').mockResolvedValue(withFailures)
    const fix = vi.spyOn(api, 'doctorFix').mockResolvedValue(healthy)
    renderDoctor()
    await waitFor(() => expect(screen.getByText('Needs attention')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Repair' }))
    await waitFor(() => expect(fix).toBeTruthy())
    await waitFor(() => expect(screen.getByText('All checks passed')).toBeTruthy())
  })

  it('shows the error card with Retry when the check fails to load', async () => {
    const doctor = vi.spyOn(api, 'doctor')
    doctor.mockRejectedValueOnce(new Error('database is locked'))
    vi.spyOn(api, 'doctorFix').mockResolvedValue(healthy)
    renderDoctor()

    await waitFor(() => expect(screen.getByText('Couldn’t run the doctor.')).toBeTruthy())
    expect(screen.getByText(/database is locked/)).toBeTruthy()
    doctor.mockResolvedValue(healthy)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('All checks passed')).toBeTruthy())
  })
})
