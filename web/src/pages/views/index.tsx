import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { SegmentedControl } from '@/components/segmented-control'
import { GalleryShell } from '@/pages/gallery/shell'
import { Markdown } from '@/pages/gallery/markdown'
import type { Traffic } from '@/views/mock/server'
import { grillSummary } from '@/views/grill'
import { VIEWS } from '@/views/registry'
import type { Handoff } from '@/views/types'
import { Log } from './log'
import { Run } from './run'

const SPEEDS = [
  { value: '1', label: '1×' },
  { value: '4', label: '4×' },
] as const

/**
 * The separable views of the product, one at a time, each live: the real
 * view, on sample data, with every action working, beside its spec.
 *
 * Not in the nav. A scenario is a situation the student can be in (a
 * question being found, a find that failed, back after a break); Replay
 * plays it again from its start. `?scenario=`, `?speed=` and `?wide=1` are
 * in the URL, so a state can be linked to.
 */
export function Views() {
  const { view } = useParams()
  const [params, setParams] = useSearchParams()
  const [replays, setReplays] = useState(0)
  const [traffic, setTraffic] = useState<Traffic[]>([])
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [spec, setSpec] = useState<{ id: string; text: string } | null>(null)
  const [grill, setGrill] = useState<{ id: string; text: string } | null>(null)
  const entry = VIEWS.find((v) => v.id === view)

  useEffect(() => {
    if (!entry) return
    let live = true
    entry.spec().then((text) => live && setSpec({ id: entry.id, text }))
    entry.grill?.().then((text) => live && setGrill({ id: entry.id, text }))
    return () => {
      live = false
    }
  }, [entry])

  const onTraffic = useCallback((t: Traffic) => setTraffic((all) => [...all, t]), [])
  const onHandoff = useCallback((h: Handoff) => setHandoffs((all) => [...all, h]), [])

  if (VIEWS.length === 0)
    return (
      <GalleryShell label="Views" basePath="/views" entries={[]}>
        <p className="text-base text-muted-foreground">No views yet.</p>
      </GalleryShell>
    )
  // A bare /views, or a view that isn't there, opens the first.
  if (!entry) return <Navigate to={`/views/${VIEWS[0].id}`} replace />

  const scenario = entry.scenarios.find((s) => s.id === params.get('scenario')) ?? entry.scenarios[0]
  const speed = params.get('speed') === '4' ? 4 : 1
  const wide = !!entry.wideLabel && params.get('wide') === '1'
  // What the column beside the view shows: its spec, its grill's summary
  // (what was decided and why), or the whole grill with the Q&A log.
  const mode = entry.wireframes && params.get('mode') === 'wireframes' ? 'wireframes' : 'live'
  const Wireframes = entry.wireframes
  const doc = entry.grill && ['grill', 'log'].includes(params.get('doc') ?? '') ? params.get('doc') : 'spec'
  const set = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const replay = () => {
    setTraffic([])
    setHandoffs([])
    setReplays((n) => n + 1)
  }

  return (
    <GalleryShell
      label="Views"
      basePath="/views"
      entries={VIEWS}
      entry={entry}
      toolbar={
        <div className="flex flex-wrap items-center justify-end gap-3">
          {entry.wireframes && (
            <SegmentedControl
              label="Mode"
              value={mode}
              onChange={(v) => set('mode', v === 'live' ? null : v)}
              options={[
                { value: 'live', label: 'Live' },
                { value: 'wireframes', label: 'Wireframes' },
              ]}
            />
          )}
          {mode === 'live' && (
            <>
          <select
            aria-label="Scenario"
            value={scenario.id}
            onChange={(e) => {
              set('scenario', e.target.value)
              replay()
            }}
            className="h-control rounded-md border border-input bg-card px-3 text-sm text-foreground"
          >
            {entry.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <SegmentedControl
            label="Speed"
            value={String(speed) as '1' | '4'}
            onChange={(v) => {
              set('speed', v === '1' ? null : v)
              replay()
            }}
            options={SPEEDS}
          />
          {entry.wideLabel && (
            <Checkbox checked={wide} onChange={() => set('wide', wide ? null : '1')}>
              {entry.wideLabel}
            </Checkbox>
          )}
          <Button variant="outline" onClick={replay}>
            <RotateCcw />
            Replay
          </Button>
            </>
          )}
        </div>
      }
    >
      {mode === 'wireframes' && Wireframes ? (
        <Wireframes />
      ) : (
        <>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{scenario.title}.</span> {scenario.note}
      </p>
      <div className={wide ? 'space-y-section' : 'grid grid-cols-[auto_1fr] items-start gap-10'}>
        <div className="space-y-4">
          <Run
            key={`${entry.id}:${scenario.id}:${speed}:${replays}`}
            entry={entry}
            scenario={scenario}
            speed={speed}
            wide={wide}
            onTraffic={onTraffic}
            onHandoff={onHandoff}
          />
          <Log handoffs={handoffs} traffic={traffic} />
        </div>
        <div className="min-w-0 space-y-4">
          {entry.grill && (
            <SegmentedControl
              label="Document"
              value={doc as 'spec' | 'grill' | 'log'}
              onChange={(v) => set('doc', v === 'spec' ? null : v)}
              options={[
                { value: 'spec', label: 'Spec' },
                { value: 'grill', label: 'Grill' },
                { value: 'log', label: 'Full log' },
              ]}
            />
          )}
          {doc === 'spec' && spec?.id === entry.id && <Markdown source={spec.text} />}
          {doc === 'grill' && grill?.id === entry.id && <Markdown source={grillSummary(grill.text)} />}
          {doc === 'log' && grill?.id === entry.id && <Markdown source={grill.text} />}
        </div>
      </div>
        </>
      )}
    </GalleryShell>
  )
}
