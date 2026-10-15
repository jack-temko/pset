import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useSettings } from '@/api/settings';
import { Box, BoxHeader, BoxRow, RowValue } from '@/components/box';
import { Button } from '@/components/button';
import { Label } from '@/components/label';
import { DurationValue, StatTile } from '@/components/stat-tile';
import { cn, plural } from '@/lib/utils';
import { finishStats, hardWhy, shortTime, toMinutes } from './finish-stats';
import { finishLine } from './greetings';
import type { Q } from './progress';

/** More questions than this and the bars go unlabelled: the names would not fit. */
const LABELLED = 12;

/** The line for this visit, chosen once so it holds still while the page
 *  redraws. In dev, `?hour=1` picks the hour, as on Home. */
function useFinishLine(name: string): string {
  const [pick] = useState(Math.random);
  const [params] = useSearchParams();
  const hourParam = import.meta.env.DEV
    ? Number(params.get('hour') ?? NaN)
    : NaN;
  const hour =
    Number.isInteger(hourParam) && hourParam >= 0 && hourParam < 24
      ? hourParam
      : new Date().getHours();
  return finishLine(hour, name, pick);
}

/**
 * The page that fills the panel when the last question is done: a line for
 * the hour, what the set took, how the time fell across its questions with
 * the longest marked, those longest, and Turn in as the one primary. Time
 * only shows once questions have been timed; until then it is the line and
 * the way out. Nothing on it is a target, a streak or a comparison with
 * earlier sets.
 */
export function Finish({
  title,
  questions,
  turnedIn,
  onTurnIn,
  onBack,
}: {
  title: string;
  questions: Q[];
  turnedIn: boolean;
  onTurnIn: () => void;
  onBack: () => void;
}) {
  const { data: settings } = useSettings();
  const line = useFinishLine(settings?.profile.name ?? '');
  const stats = finishStats(questions);
  const labelled = questions.length <= LABELLED;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-card py-8 text-center">
        {/* my-auto centers it in the pane when there is little to show (no
            timing yet) and lets it scroll from the top when there is a lot. */}
        <div className="my-auto flex w-full flex-col items-center gap-5">
          <div className="shrink-0 space-y-2">
            <h2 className="font-heading text-4xl">{line}</h2>
            <p className="font-heading text-lg text-muted-foreground italic">
              {questions.length === 1
                ? 'The one question is'
                : `All ${questions.length} are`}{' '}
              done in {title}.
            </p>
          </div>
          {stats.timed > 0 && (
            <div className="grid w-full shrink-0 grid-cols-2 gap-3 text-left">
              <StatTile
                label="Total time"
                value={<DurationValue minutes={toMinutes(stats.total)} />}
                context={`across ${plural(stats.timed, 'question')}`}
              />
              <StatTile
                label="Per question"
                value={<DurationValue minutes={toMinutes(stats.average)} />}
                context="about, on average"
              />
            </div>
          )}
          {stats.timed > 1 && (
            <div className="w-full shrink-0 space-y-2 text-left">
              <p className="text-xs text-muted-foreground">Time per question</p>
              <div
                role="img"
                aria-label="Time per question"
                className="flex h-24 items-end gap-1"
              >
                {questions.map((q) => (
                  <span
                    key={q.id}
                    title={`${q.label}: ${shortTime(q.seconds ?? 0)}`}
                    style={{
                      height: `${((q.seconds ?? 0) / stats.most) * 100}%`,
                    }}
                    className={cn(
                      'flex-1 rounded-sm',
                      q.seconds === stats.most
                        ? 'bg-primary'
                        : 'bg-foreground/25',
                    )}
                  />
                ))}
              </div>
              {labelled && (
                <div className="flex gap-1 text-xs text-muted-foreground tabular-nums">
                  {questions.map((q) => (
                    <span key={q.id} className="flex-1 truncate text-center">
                      {q.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {stats.hardest.length > 0 && (
            <Box className="w-full shrink-0 text-left">
              <BoxHeader>The hardest</BoxHeader>
              {stats.hardest.map((q, i) => (
                <BoxRow
                  key={q.id}
                  title={q.label}
                  description={hardWhy(q, i, stats.hardest)}
                  trailing={<RowValue>{shortTime(q.seconds ?? 0)}</RowValue>}
                />
              ))}
            </Box>
          )}
        </div>
      </div>
      {/* The way out is pinned, as the question's footer is: Turn in is the one primary. */}
      <div className="flex shrink-0 items-center justify-between border-t p-card">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back to list
        </Button>
        {turnedIn ? (
          <Label tone="success">Turned in</Label>
        ) : (
          <Button onClick={onTurnIn}>Turn in</Button>
        )}
      </div>
    </>
  );
}
