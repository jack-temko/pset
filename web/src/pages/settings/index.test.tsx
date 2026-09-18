import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { Settings } from './index'
import { api } from '@/lib/api'
import type { Config, ConfigTest, Health, ResetCounts } from '@/lib/types'

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

const config: Config = {
  apiBaseURL: 'https://api.example.com',
  hasAPIKey: true,
  embedBaseURL: 'http://127.0.0.1:11434/v1',
  embedModel: 'nomic-embed-text',
}

const health: Health = {
  status: 'ok',
  version: '0.1.0-test',
  databasePath: '/tmp/pset-visual/pset.db',
  libraryDirectory: '/tmp/pset-visual/library',
}

function mockDefaults() {
  const spies = {
    getConfig: vi.spyOn(api, 'getConfig'),
    books: vi.spyOn(api, 'books'),
    health: vi.spyOn(api, 'health'),
    updateConfig: vi.spyOn(api, 'updateConfig'),
    testConfig: vi.spyOn(api, 'testConfig'),
    reset: vi.spyOn(api, 'reset'),
  }
  spies.getConfig.mockResolvedValue(config)
  spies.books.mockResolvedValue([])
  spies.health.mockResolvedValue(health)
  spies.updateConfig.mockImplementation(async (patch: Partial<Config>) => ({
    ...config,
    ...patch,
  }))
  const testResult: ConfigTest = {
    ok: true,
    chat: { ok: true, detail: '' },
    embed: { ok: true, detail: '' },
  }
  spies.testConfig.mockResolvedValue(testResult)
  return spies
}

function typeInto(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('Settings page', () => {
  it('keeps Save & test disabled until an edit is dirty', async () => {
    mockDefaults()
    render(<Settings />)
    await waitFor(() => expect(screen.getByLabelText('API address')).toBeTruthy())
    const button = screen.getByRole('button', { name: 'Save & test' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    typeInto('API key', 'new-secret')
    expect(button.disabled).toBe(false)
  })

  it('saves the patch before testing, then shows the verdicts', async () => {
    const spies = mockDefaults()
    const order: string[] = []
    spies.updateConfig.mockImplementation(async (patch: Partial<Config>) => {
      order.push('save')
      return { ...config, ...patch }
    })
    spies.testConfig.mockImplementation(async () => {
      order.push('test')
      return { ok: false, chat: { ok: true, detail: '' }, embed: { ok: false, detail: 'connection refused' } }
    })

    render(<Settings />)
    await waitFor(() => expect(screen.getByLabelText('API address')).toBeTruthy())
    typeInto('Search model', 'nomic-embed-text-v1.5')
    fireEvent.click(screen.getByRole('button', { name: 'Save & test' }))

    await waitFor(() => expect(screen.getAllByText('is working').length).toBe(1))
    expect(order).toEqual(['save', 'test'])
    expect(spies.updateConfig).toHaveBeenCalledWith({ embedModel: 'nomic-embed-text-v1.5' })
    expect(screen.getByText('Chat')).toBeTruthy()
    expect(screen.getByText('connection refused')).toBeTruthy()
    // The edits landed: the button is clean again.
    expect((screen.getByRole('button', { name: 'Save & test' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('previews the reset counts and wipes task history with everything else', async () => {
    const spies = mockDefaults()
    const counts: ResetCounts = { books: 3, pages: 16, libraryFiles: 3, finishedTasks: 2 }
    spies.reset.mockImplementation(async (apply: boolean) => {
      if (!apply) return counts
      return { books: 0, pages: 0, libraryFiles: 0, finishedTasks: 0 }
    })

    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() =>
      expect(screen.getByText(/3 books · 16 indexed pages/)).toBeTruthy(),
    )
    expect(screen.getByText(/2 finished tasks would be deleted/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete everything…' }))
    expect(screen.getByText('Reset PSet?')).toBeTruthy()
    expect(screen.getByText(/This cannot be undone/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
    await waitFor(() => expect(screen.getByText('Reset complete. The library is empty.')).toBeTruthy())
    expect(spies.reset).toHaveBeenCalledWith(true)
  })
})
