import { PartyPopper } from 'lucide-react';

import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { minutesText } from '@/units/set-line/dates';
import { Tag } from '@/units/tag';

/** The short moment after the last problem is marked done: how many and how
 *  long, then the one place to hand in (P12). Once turned in, Take back sits
 *  where Turn in was (P9). */
export function FinishCard({
  count,
  minutes,
  turnedIn = false,
  onTurnIn,
  onTakeBack,
  onBack,
}: {
  /** Problems in the set, all done. */
  count: number;
  /** Time spent on the set; nothing is said when PSet does not know it. */
  minutes?: number;
  turnedIn?: boolean;
  onTurnIn?: () => void;
  onTakeBack?: () => void;
  /** Back to the course. */
  onBack?: () => void;
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-(--ds-radius-control) border border-(--ds-border) px-6 py-6">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <PartyPopper
          className="size-6 shrink-0 text-(--ds-accent)"
          aria-hidden
        />
        <h2 className="ds-heading min-w-0 text-(--ds-fg) [overflow-wrap:anywhere]">
          All {count} done
          {minutes !== undefined && minutes > 0
            ? ` · ${minutesText(minutes)}`
            : ''}
        </h2>
        {turnedIn && <Tag>Turned in</Tag>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {turnedIn ? (
          <Button
            onPress={() => {
              onTakeBack?.();
            }}
          >
            Take back
          </Button>
        ) : (
          <Button
            variant="primary"
            onPress={() => {
              onTurnIn?.();
            }}
          >
            Turn in
          </Button>
        )}
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onBack?.();
          }}
        >
          Back to the course
        </Link>
      </div>
    </section>
  );
}
