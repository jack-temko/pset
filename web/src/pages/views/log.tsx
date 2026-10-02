import { Box, BoxHeader, BoxRow, Counter } from '@/components/box'
import type { Traffic } from '@/views/mock/server'
import type { Handoff } from '@/views/types'
import { cn } from '@/lib/utils'

const SHOWN = 8

/**
 * What the view did, beside it: the handoffs it sent (where it would have
 * taken the student, and with what) and the API calls it made. A spec's
 * `data` and `handoffs` are checked against this, not against memory.
 */
export function Log({ handoffs, traffic }: { handoffs: Handoff[]; traffic: Traffic[] }) {
  return (
    <div className="space-y-4">
      <Box>
        <BoxHeader>
          Handoffs <Counter>{handoffs.length}</Counter>
        </BoxHeader>
        {handoffs.length === 0 && <BoxRow title="None yet" description="Use a way out of the view: an action that sends the student elsewhere." />}
        {handoffs
          .slice(-SHOWN)
          .reverse()
          .map((h, i) => (
            <BoxRow key={handoffs.length - i} title={`${h.what} → ${h.to}`} description={h.carries} />
          ))}
      </Box>
      <Box>
        <BoxHeader>
          API calls <Counter>{traffic.length}</Counter>
        </BoxHeader>
        {traffic.length === 0 && <BoxRow title="None yet" />}
        {traffic
          .slice(-SHOWN)
          .reverse()
          .map((t, i) => (
            <BoxRow
              key={traffic.length - i}
              title={<span className="font-mono text-xs">{`${t.method} ${t.path}`}</span>}
              trailing={<span className={cn('font-mono text-xs tabular-nums', t.status >= 400 && 'text-destructive')}>{t.status}</span>}
            />
          ))}
      </Box>
    </div>
  )
}
