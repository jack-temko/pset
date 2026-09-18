import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ListTodo } from 'lucide-react'

import { PageShell } from '@/components/page-shell'
import { EmptyState, ErrorState } from '@/components/states'
import { TaskRow, TaskSectionLabel } from '@/components/task-row'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTasks } from '@/lib/events'
import type { Task } from '@/lib/types'

function TaskSection({
  label,
  tasks,
  children,
}: {
  label: string
  tasks: Task[]
  children?: ReactNode
}) {
  if (tasks.length === 0) return null
  return (
    <section className="space-y-3">
      <TaskSectionLabel label={label} count={tasks.length} />
      <ul className="divide-y rounded-xl border bg-card">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        {children}
      </ul>
    </section>
  )
}

/**
 * Where you come to fix things, not to watch them — the sidebar card is for
 * watching. History prunes itself as tasks settle, so there is nothing here
 * to clear by hand.
 */
export function Tasks() {
  const api = useTasks()
  const paused = (api.tasks ?? []).filter((t) => t.status === 'paused')

  return (
    <PageShell
      title="Tasks"
      description="Books being prepared and homework being written, with what each one is doing."
    >
      {api.loading ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="p-4">
              <Skeleton className="h-6 w-full" />
            </li>
          ))}
        </ul>
      ) : api.error && api.tasks === null ? (
        <ErrorState title="Couldn’t load tasks." message={api.error} onRetry={api.refresh} />
      ) : (api.tasks ?? []).length === 0 ? (
        <EmptyState
          icon={<ListTodo className="size-5" />}
          title="Nothing to do."
          message="Import a book or start an assignment and it shows up here."
          action={
            <Button asChild>
              <Link to="/?import=1">Import a PDF</Link>
            </Button>
          }
        />
      ) : (
        <>
          <TaskSection label="Needs you" tasks={api.attention} />
          <TaskSection label="Running" tasks={api.running} />
          <TaskSection label="Waiting" tasks={api.queued} />
          <TaskSection label="Paused" tasks={paused} />
          <TaskSection label="Done" tasks={api.finished} />
        </>
      )}
    </PageShell>
  )
}
