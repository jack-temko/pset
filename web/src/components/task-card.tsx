import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { CircleAlert, ListTodo, Loader2, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useTasks } from '@/lib/events'
import {
  phasePosition,
  staleStamp,
  taskActionLabel,
  taskEtaLine,
  taskHeadline,
  taskProgress,
  taskUnit,
} from '@/lib/tasks'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The Tasks entry at the bottom of the sidebar.
 *
 * The nav item is permanent — tapping it is how you reach the history on
 * /tasks, active or not. What comes and goes is the panel above it: when a
 * task starts, its top border grows upward into the rail's empty space,
 * wrapping a quiet dark panel around the task. The border is the animation —
 * the sides extend and the top rides up over the new content, and when the
 * content goes the panel sinks back down into the nav item.
 */
export function TaskCard() {
  const { running, queued, attention, connected, lastBeat } = useTasks()
  const now = useNow(connected ? null : 15_000)

  const active = running[0] ?? queued[0] ?? null
  const trouble = attention[0] ?? null

  // The store can drop a task the moment it settles, so the body is latched:
  // while the panel collapses it keeps showing the last content it had, and
  // only unmounts once the border has sunk all the way down.
  let panel: ReactNode = null
  if (!connected && lastBeat !== null) {
    // A lost stream is an app-level fact, and this is where it shows: the
    // numbers stay put with an honest stamp rather than a spinner turning
    // over a count that stopped moving.
    panel = (
      <Panel tone="warning">
        <div className="flex items-center gap-2 text-sidebar-foreground">
          <WifiOff className="size-3 shrink-0" />
          <span className="text-xs font-medium">Lost touch with pset</span>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Reconnecting…</p>
        {active ? (
          <>
            <div className="mt-2 opacity-60">
              <ActiveBody task={active} />
            </div>
            <p className="text-xs text-sidebar-foreground/50">{staleStamp(lastBeat, now)}</p>
          </>
        ) : null}
      </Panel>
    )
  } else if (trouble && !active) {
    // A failure waiting on a decision is not urgent in the same way a running
    // task is, but it is exactly what the panel is for: the reason, and the
    // door out.
    panel = (
      <Panel tone="destructive">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-1 size-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{trouble.title}</p>
            <p className="text-xs text-sidebar-foreground/60">
              {trouble.error ?? 'Something went wrong.'}
            </p>
          </div>
        </div>
        <Link to="/tasks" className="block">
          <Button size="sm" variant="outline" className="w-full">
            {taskActionLabel(trouble) ?? 'See what happened'}
          </Button>
        </Link>
      </Panel>
    )
  } else if (active) {
    const waiting = queued.length - (running.length > 0 ? 0 : 1)
    panel = (
      <Panel>
        <ActiveBody task={active} showStop />
        {waiting > 0 ? (
          <p className="text-xs text-sidebar-foreground/50">{waitingLine(waiting)}</p>
        ) : null}
        {trouble ? (
          <Link
            to="/tasks"
            className="flex items-center gap-2 border-t border-sidebar-border pt-2 text-xs text-destructive hover:underline"
          >
            <CircleAlert className="size-3 shrink-0" />
            {attentionLine(attention.length)}
          </Link>
        ) : null}
      </Panel>
    )
  }

  const open = panel !== null
  const [collapsing, setCollapsing] = useState(false)
  const lastBody = useRef<ReactNode>(null)
  useEffect(() => {
    if (open) {
      lastBody.current = panel
      setCollapsing(false)
      return
    }
    // Outlives the 200ms collapse, then the body unmounts for real.
    const t = setTimeout(() => setCollapsing(false), 240)
    setCollapsing(true)
    return () => clearTimeout(t)
  }, [open, panel])
  const body = panel ?? (collapsing ? lastBody.current : null)

  return (
    <>
      <div
        inert={!open}
        className={cn(
          'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-linear',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">{body}</div>
      </div>
      <TasksNavItem />
    </>
  )
}

/** The panel's frame: dark interior, and the border whose top edge is the
 *  moving part of the growth animation. The bottom margin sits inside the
 *  clipped layer, so the gap to the nav item grows in with the panel. */
function Panel({ children, tone }: { children: React.ReactNode; tone?: 'warning' | 'destructive' }) {
  return (
    <div
      className={cn(
        'mb-2 flex flex-col gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3',
        tone === 'warning' && 'border-warning/40',
        tone === 'destructive' && 'border-destructive/50',
      )}
    >
      {children}
    </div>
  )
}

/** The permanent form: Tasks as a plain destination, indistinguishable from
 *  Books, Homework or Ask — including when the rail is collapsed to icons,
 *  where the tooltip is the only label. The panel above comes and goes; this
 *  row, and with it the way to the task history, never does. */
function TasksNavItem() {
  const { pathname } = useLocation()
  const isActive = pathname.startsWith('/tasks')
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip="Tasks">
          <NavLink to="/tasks">
            <ListTodo className={cn(isActive && 'text-sidebar-primary')} />
            <span>Tasks</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function waitingLine(n: number): string {
  return n === 1 ? '1 more waiting' : `${n} more waiting`
}

function attentionLine(n: number): string {
  return n === 1 ? '1 needs you' : `${n} need you`
}

/** What is happening, how far along, how long left — and a way to stop. */
function ActiveBody({ task, showStop }: { task: Task; showStop?: boolean }) {
  const { stop } = useTasks()
  const [stopping, setStopping] = useState(false)
  const progress = taskProgress(task)
  const eta = taskEtaLine(task)
  const { index, total } = phasePosition(task)

  return (
    <>
      <div className="flex items-start gap-2">
        <Loader2 className="size-3 shrink-0 animate-spin text-sidebar-primary" />
        <p className="min-w-0 flex-1 text-xs leading-snug font-medium text-sidebar-foreground">
          {taskHeadline(task)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <PhasePips index={index} total={total} />
        {progress ? (
          <>
            <Progress value={(progress.done / progress.total) * 100} className="flex-1" />
            <span className="font-mono text-xs text-sidebar-foreground/60 tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </>
        ) : (
          <Progress className="flex-1" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground/60">
          {eta ?? (progress ? taskUnit(task, progress.total) : 'working…')}
        </span>
        {showStop ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-xs"
            disabled={stopping || task.status !== 'running'}
            onClick={async () => {
              setStopping(true)
              await stop(task.id)
              setStopping(false)
            }}
          >
            Stop
          </Button>
        ) : null}
      </div>
    </>
  )
}

/**
 * Four pips for the four phases of a preparation. The bar above shows the
 * phase; these show where the phase sits in the whole, because the phases
 * are wildly unequal and one overall bar would lie.
 */
function PhasePips({ index, total }: { index: number; total: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'size-2 rounded-full',
            // The sidebar is dark ink in both themes, so these key off the
            // sidebar's own foreground: a border token would be dark on dark
            // and simply not render.
            i < index && 'bg-sidebar-foreground/60',
            i === index && 'bg-sidebar-primary',
            i > index && 'bg-sidebar-foreground/20',
          )}
        />
      ))}
    </span>
  )
}

/** A ticking clock, only while something needs one. */
function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (intervalMs === null) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
