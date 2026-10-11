import { ErrorNotice } from '@/components/error-notice';
import { useState } from 'react';
import {
  AnswersCard,
  AssistantTurn,
  Callout,
  ConversationStart,
  DayDivider,
  GuidePara,
  MathDisplay,
  MathInline,
  AnswerTable,
  CodeBlock,
  Note,
  PageRef,
  PartHeader,
  Plot,
  Statement,
  StepHeading,
  Steps,
  StoppedNote,
  Thinking,
  UserTurn,
  WorkedSteps,
  AboutChip,
} from '@/components/transcript';
import { BLOCKS, GUIDE, GUIDE_HINT } from '@/components/fixtures';
import { AnswersOf, BlockSkeleton, Document } from '@/components/document';
import {
  answerAbout,
  guideAbout,
  type Sel,
} from '@/components/document/selection';
import type { AskWiring } from '@/components/document/selectable';
import type { About } from '@/api/ask';
import type { Block } from '@/api/gen/doc';
import { PageMap, Pages } from '@/lib/pages';
import { FigureReading } from '@/pages/workspace/reading';
import type { Question } from '@/api/homework';
import type { ComponentEntry } from './types';
import { Shelf } from './shared';

/** A paragraph of the phone-plan guide, as the server splits it. */
const PLAN_PARA: Block = {
  type: 'para',
  text: [
    {
      t: 'The plan charges 15 dollars a month plus 1 dollar a minute, so a month with ',
    },
    { m: 'M' },
    { t: ' minutes costs ' },
    { m: 'C = 15 + M' },
    { t: '. If each minute ends the call with probability ' },
    { m: 'p' },
    { t: ', then ' },
    { m: 'E[M] = 1/p' },
    { t: ' ' },
    { cite: 108 },
    { t: '.' },
  ],
};

/** Sample series for the Plot demo: logistic growth levelling at 100
 *  against the exponential it starts out as. */
const EXP: [number, number][] = [
  [0.0, 10.0],
  [0.5, 12.84],
  [1.0, 16.49],
  [1.5, 21.17],
  [2.0, 27.18],
  [2.5, 34.9],
  [3.0, 44.82],
  [3.5, 57.55],
  [4.0, 73.89],
  [4.5, 94.88],
];

const LOGISTIC: [number, number][] = [
  [0.0, 10.0],
  [0.5, 12.49],
  [1.0, 15.48],
  [1.5, 19.04],
  [2.0, 23.2],
  [2.5, 27.94],
  [3.0, 33.24],
  [3.5, 39.0],
  [4.0, 45.09],
  [4.5, 51.32],
  [5.0, 57.51],
  [5.5, 63.48],
  [6.0, 69.06],
  [6.5, 74.13],
  [7.0, 78.63],
  [7.5, 82.53],
  [8.0, 85.85],
];

/** The guide's plot: problem 3.7.8's new phone plan, 15 + 1/p, against the
 *  old one, 20 + (1-p)^30/(2p), for the same caller. They cross just under
 *  p = 0.2, where a caller averages five minutes a month. */
const PS = Array.from({ length: 37 }, (_, i) => 0.05 + i * 0.0125);

const COST: [number, number][] = PS.map((p) => [
  +p.toFixed(4),
  +(15 + 1 / p).toFixed(2),
]);

const OLD_PLAN: [number, number][] = PS.map((p) => [
  +p.toFixed(4),
  +(20 + (1 - p) ** 30 / (2 * p)).toFixed(2),
]);

/**
 * Every component and every variant, on one page, in the app itself.
 *
 * Not in the nav and not part of the product's three screens: it is the
 * page you open to see what a change did. Add a component here the moment
 * you build one; anything missing from this page is unreviewed.
 */

const readingLine = (t: string) => [{ t }];

/** 4.72's figure as read, for the Figure reading shelf. */
const READ_QUESTION: Question = {
  id: 'q-read',
  homeworkId: 'h1',
  position: 1,
  text: '4.72',
  inBook: true,
  label: '4.72',
  statement: [],
  page: 194,
  figures: [{ label: 'Figure 4.138' }],
  hint: [],
  walkthrough: [],
  state: 'ready',
  readingEdited: false,
  readingDoubts: [],
  notes: [],
  boxes: [],
  revealed: [],
  done: false,
  activity: '',
  reason: '',
  updatedAt: '',
  rev: 1,
  reading: [
    'Node L: top of the 4 A source, top of the 2 Ω, left end of the 4 Ω.',
    'Node N: right end of the 4 Ω, left end of the 6 Ω, left end of the 2 A source.',
    'Node a: right end of the 6 Ω, right end of the 2 A source, top of R_L.',
    'Node D: bottom of the 4 A source, bottom of the 2 Ω, + of the 20 V source.',
    '4 A current source from D to L (its arrow points to L).',
    '2 A current source from N to a (its arrow points to a).',
    '20 V source between D and b, + at D.',
  ].map(readingLine),
};

const READING_DOUBTS = [
  'The 2 A source: two readings have its arrow pointing to a, one to N; it points to a.',
  'The 20 V source: two readings have + at D, one at b; + is at D.',
].map(readingLine);

/** A document that selects, held together for the demo the way the
 *  workspace holds it: the outline and the chip one state, ✕ or Esc
 *  drops both, and the chip rides where the composer is. */
function SelectingDocument({
  blocks,
  stage,
}: {
  blocks: Block[];
  stage: 'walkthrough' | 'answer';
}) {
  const [sel, setSel] = useState<Sel | null>(null);
  const [about, setAbout] = useState<About | null>(null);
  const ask: AskWiring = {
    selected: sel,
    onPick: (picked) => {
      setSel(picked);
    },
    onAsk: (picked) => {
      setSel(picked);
      setAbout(
        stage === 'walkthrough'
          ? guideAbout({
              question: '3.7.8',
              problem:
                'A phone plan charges $15 a month plus $1 a minute. Each minute ends the call with probability p. For what p is it cheaper than the old plan?',
              blocks,
              sel: picked,
              stage: 'walkthrough',
              pages: DEMO_PAGES,
            })
          : answerAbout({
              question: 'When is the new plan cheaper than the old one?',
              blocks,
              sel: picked,
              pages: DEMO_PAGES,
            }),
      );
    },
    onClear: () => {
      setSel(null);
      setAbout(null);
    },
  };
  return (
    <div className="space-y-3">
      <Document
        reading={stage === 'walkthrough'}
        blocks={blocks}
        onJump={() => {}}
        ask={ask}
      />
      <div className="flex min-h-control items-center gap-2 rounded-md border bg-card p-2">
        {about ? (
          <AboutChip label={about.label} onRemove={ask.onClear} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Hover an element, click it, then Ask about it. A line of a
            derivation, and a part or step heading (its whole group), select
            too.
          </p>
        )}
      </div>
    </div>
  );
}

const DEMO_PAGES = PageMap.single(16);

export const documentSections: ComponentEntry[] = [
  {
    id: 'transcript',
    title: 'Transcript',
    group: 'Document and transcript',
    note: 'Asymmetric: you speak in a soft block, the book answers full-width. Steps are one line per tool call: the live one in full ink with its spinner, fading back to quiet ink when the next begins or the answer ends. Thinking… is the wait on the model when nothing else says so.',
    docs: ['transcript'],
    Demo: () => (
      <>
        <Shelf label="turn">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <UserTurn>
              Why does every operator have a minimal polynomial?
            </UserTurn>
            <Steps
              steps={[
                'Searched ‘minimal polynomial’ · 6 pages',
                'Read p. 142–145',
              ]}
            />
            <AssistantTurn>
              <p>
                Because powers of <MathInline tex="T" /> cannot stay independent
                forever <PageRef pdf={142} />: the space has dimension{' '}
                <MathInline tex="n^2" />.
              </p>
              <MathDisplay tex="I,\;T,\;T^2,\;\dots,\;T^{n^2}" />
            </AssistantTurn>
          </div>
        </Shelf>
        <Shelf label="failed">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <Steps steps={['Searched ‘spectral theorem’ · 5 pages']} />
            <ErrorNotice
              error={{
                id: 'ask.turn_failed',
                what: "Couldn't answer that.",
                why: 'The connection to the model dropped while it was writing.',
                fix: 'Trying again usually works.',
                action: 'retry',
                scope: 'inline',
                chain: ['ask.turn_failed', 'model.cut'],
              }}
              onRetry={() => {}}
            />
          </div>
        </Shelf>
        <Shelf label="failed: setup">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <ErrorNotice
              error={{
                id: 'ask.turn_failed',
                what: "Couldn't answer that.",
                why: 'PSet needs a key to read pages and write answers.',
                fix: 'Add your key in Settings, under Connections.',
                action: 'open_settings',
                scope: 'inline',
                chain: ['ask.turn_failed', 'key.missing'],
              }}
            />
          </div>
        </Shelf>
        <Shelf label="marks">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <ConversationStart />
            <DayDivider label="Yesterday" />
          </div>
        </Shelf>
        <Shelf label="running">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <Steps
              running
              steps={['Searched ‘eigenvalue’ · 6 pages', 'Reading p. 132–134…']}
            />
          </div>
        </Shelf>
        <Shelf label="thinking">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <UserTurn>What does the damping term do to the spring?</UserTurn>
            <Thinking />
          </div>
        </Shelf>
        <Shelf label="thinking after steps">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <Steps
              thinking
              steps={[
                'Searched ‘damped vibrations’ · 6 pages',
                'Read p. 150–155',
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="stopped">
          <div className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
            <p>An eigenvalue is a scalar λ for which some nonzero vector</p>
            <StoppedNote />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'figure-reading',
    title: 'Figure reading',
    group: 'Document and transcript',
    note: "The words a guide is written from, one fact a line, which the student can correct. Where the figure's three readings disagreed, the Box says Check it and names each point, with what the readings said and what was settled: readings that agree are nearly always right, ones that don't nearly always hold a wrong one. Correcting it, or reading it again, clears them.",
    Demo: () => (
      <>
        <Shelf label="agreed">
          <div className="w-panel">
            <FigureReading
              q={READ_QUESTION}
              onCorrect={() => {}}
              onReread={() => {}}
            />
          </div>
        </Shelf>
        <Shelf label="disagreed">
          <div className="w-panel">
            <FigureReading
              q={{ ...READ_QUESTION, readingDoubts: READING_DOUBTS }}
              onCorrect={() => {}}
              onReread={() => {}}
            />
          </div>
        </Shelf>
        <Shelf label="corrected">
          <div className="w-panel">
            <FigureReading
              q={{ ...READ_QUESTION, readingEdited: true }}
              onCorrect={() => {}}
              onReread={() => {}}
            />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'answer-cards',
    title: 'Answer cards',
    group: 'Document and transcript',
    note: 'A short list on purpose: what the book says, how to do it, what it looks like. Tables and code are plain blocks. Everything else is prose.',
    Demo: () => (
      <>
        <Shelf label="statement">
          <div className="w-panel">
            <Statement
              kind="Definition"
              number="2.17"
              name="linearly independent"
              page={32}
            >
              <p>
                A list <MathInline tex="v_1, \dots, v_m" /> in{' '}
                <MathInline tex="V" /> is linearly independent if the only
                choice of <MathInline tex="a_1, \dots, a_m" /> that makes{' '}
                <MathInline tex="a_1 v_1 + \dots + a_m v_m = 0" /> is{' '}
                <MathInline tex="a_1 = \dots = a_m = 0" />.
              </p>
            </Statement>
          </div>
        </Shelf>
        <Shelf label="worked steps">
          <div className="w-panel">
            <WorkedSteps
              steps={[
                {
                  math: '\\int_0^1 x e^{x}\\,dx',
                  why: 'Integrate by parts with u = x, dv = eˣ dx.',
                },
                { math: '= \\big[x e^{x}\\big]_0^1 - \\int_0^1 e^{x}\\,dx' },
                { math: '= e - (e - 1)' },
                { math: '= 1' },
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="plot">
          <div className="w-panel">
            <Plot
              title="Logistic growth against pure exponential"
              x={{ label: 't' }}
              y={{ label: 'population' }}
              series={[
                { label: 'Exponential', points: EXP },
                { label: 'Logistic', points: LOGISTIC },
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="table">
          <div className="w-panel">
            <AnswerTable
              columns={['', 'Injective', 'Surjective']}
              rows={[
                ['Means', 'null T = {0}', 'range T = W'],
                ['Needs', 'dim V ≤ dim W', 'dim V ≥ dim W'],
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="code">
          <div className="w-panel">
            <CodeBlock
              language="scheme"
              code={`(define (fib n)\n  (if (< n 2)\n      n\n      (+ (fib (- n 1)) (fib (- n 2)))))`}
            />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'guide',
    title: 'Guide',
    group: 'Document and transcript',
    note: "What a structured guide is made of, at the panel's width: a part's eyebrow over a serif title, numbered serif steps, prose at 18/30 with the math a little larger, small muted notes, callouts on their status tints, plots with marks, and the answers card. Content from the phone-plan and eigenvalue examples in ideas/structured-guides.md.",
    Demo: () => (
      <>
        <Shelf label="part header">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <PartHeader
              first
              label="Problem 3.7.8"
              title="What the new plan costs"
            />
            <GuidePara>
              The first part of a guide has no hairline above it. Every later
              part does.
            </GuidePara>
            <PartHeader label="(b)" title="When the new plan is cheaper" />
          </div>
        </Shelf>
        <Shelf label="step heading">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <StepHeading number={1} title="Where the sum from 31 comes from" />
            <StepHeading
              number={2}
              title="Collect the probability onto each cost"
            />
            <StepHeading
              number={12}
              title="Numbers stay in a column of their own width"
            />
          </div>
        </Shelf>
        <Shelf label="note">
          <div className="w-panel space-y-5 rounded-md border bg-rail p-card">
            <Note>
              A quick check: the eigenvalues add to the trace,{' '}
              <MathInline tex="2 + 2 = 4" />, and multiply to the determinant,{' '}
              <MathInline tex="4 - 1 = 3" />.
            </Note>
          </div>
        </Shelf>
        <Shelf label="callout">
          <div className="w-panel space-y-4 rounded-md border bg-rail p-card">
            <Callout tone="insight" title="Why the 15 doesn't move">
              <p>
                The flat fee is paid whatever you say, so it can only shift the
                answer, never change how it grows with <MathInline tex="p" />.
              </p>
            </Callout>
            <Callout tone="caveat" title="A common slip">
              <p>
                <MathInline tex="E[1/X]" /> is not <MathInline tex="1/E[X]" />.
                Here it works only because the minutes are the geometric
                variable itself.
              </p>
            </Callout>
            <Callout tone="check" title="Check your answer">
              <p>
                Put <MathInline tex="p = 0.2" /> back in:{' '}
                <MathInline tex="15 + 1/0.2 = 20" /> dollars a month.
              </p>
            </Callout>
            <Callout tone="insight">
              <p>Without a title, the text stands alone.</p>
            </Callout>
          </div>
        </Shelf>
        <Shelf label="answers card">
          <div className="w-panel space-y-4 rounded-md border bg-rail p-card">
            <AnswersCard
              title="Answers"
              answers={[
                {
                  label: '(a)',
                  children: (
                    <p>
                      <MathInline tex="E[C] = 15 + 1/p" />
                    </p>
                  ),
                },
                {
                  label: '(b)',
                  children: (
                    <p>
                      <MathInline tex="p \ge 0.2" /> keeps the new plan the
                      cheaper one.
                    </p>
                  ),
                },
                {
                  label: '3.7.7',
                  children: (
                    <p>The 3.6.6 caller pays $25.42 a month on the old plan.</p>
                  ),
                },
              ]}
            />
            <AnswersCard
              answers={[
                {
                  children: (
                    <p>
                      No, <MathInline tex="F_T" /> is not a valid CDF: it falls
                      after <MathInline tex="t = 1 + \sqrt{2}" />.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="answers card, narrow">
          <div className="w-48 rounded-md border bg-rail p-card">
            <AnswersCard
              answers={[
                {
                  label: '(a)',
                  children: (
                    <p>
                      <MathInline tex="\lambda_1 = 1" /> and{' '}
                      <MathInline tex="\lambda_2 = 3" />.
                    </p>
                  ),
                },
                {
                  label: '(b)',
                  children: (
                    <p>
                      Eigenvectors <MathInline tex="(1, -1)" /> and{' '}
                      <MathInline tex="(1, 1)" />.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="plot with marks">
          <div className="w-panel">
            <Plot
              title="Expected monthly cost against p"
              x={{ label: 'p' }}
              y={{ label: 'dollars' }}
              series={[
                { label: 'New plan, 15 + 1/p', points: COST },
                { label: 'Old plan', points: OLD_PLAN },
              ]}
              marks={[
                { x: 0.2, y: 20, label: 'p ≈ 0.2' },
                { x: 1 / 30, label: 'p = 1/30' },
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="plot with marks, wide">
          <div className="w-panel-wide">
            <Plot
              title="Expected monthly cost against p"
              x={{ label: 'p' }}
              y={{ label: 'dollars' }}
              series={[{ label: 'New plan, 15 + 1/p', points: COST }]}
              marks={[
                { x: 0.1, y: 25, label: 'One call in ten ends each minute' },
                { x: 0.25, y: 19, label: 'p = 0.25' },
                { x: 0.4, y: 17.5 },
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="prose: reading">
          <div className="w-panel space-y-3 rounded-md border bg-rail p-card">
            <Pages value={PageMap.single(16)}>
              <Document reading blocks={[PLAN_PARA]} />
            </Pages>
          </div>
        </Shelf>
        <Shelf label="prose: ask (unchanged)">
          <div className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
            <Pages value={PageMap.single(16)}>
              <Document blocks={[PLAN_PARA]} />
            </Pages>
          </div>
        </Shelf>
        <Pages value={PageMap.single(16)}>
          <Shelf label="a guide: phone plan">
            <div className="w-panel space-y-4 rounded-md border bg-rail p-card">
              <PartHeader
                first
                label="Problem 3.7.8"
                title="What the new plan costs"
              />
              <StepHeading number={1} title="What one minute is worth" />
              <GuidePara>
                Each minute a caller talks ends the call with probability{' '}
                <MathInline tex="p" />, so the length <MathInline tex="M" /> of
                a call is geometric and <MathInline tex="E[M] = 1/p" />{' '}
                <PageRef pdf={108} />. At $1 a minute, <MathInline tex="1/p" />{' '}
                minutes is <MathInline tex="1/p" /> dollars.
              </GuidePara>
              <StepHeading number={2} title="Add the flat fee" />
              <GuidePara>
                The $15 is paid whatever the caller says, so it simply adds on:
              </GuidePara>
              <MathDisplay tex="E[C] = 15 + \frac{1}{p}" />
              <Callout tone="insight" title="Why it is obviously right">
                <p>
                  Talkative callers (small <MathInline tex="p" />) cost a lot; a
                  caller who hangs up at once costs just the $15 plus a dollar.
                </p>
              </Callout>
              <Note>
                Reading: both plans are priced for the same caller. Pricing the
                old plan at the 3.6.6 caller&apos;s $25.42 instead would give{' '}
                <MathInline tex="p > 0.0959" />.
              </Note>
              <PartHeader label="(b)" title="When the new plan is cheaper" />
              <StepHeading
                number={1}
                title="Put the same caller on both plans"
              />
              <WorkedSteps
                steps={[
                  {
                    math: '15 + \\frac{1}{p} < 20 + \\frac{(1-p)^{30}}{2p}',
                    why: 'The new plan must cost less for this caller.',
                  },
                  {
                    math: '15 + \\frac{1}{p} < 20',
                    why: 'From p = 0.2 up, the overage term is under a cent.',
                  },
                  {
                    math: 'p > 0.2',
                    why: 'Subtract 15 and take reciprocals; the exact crossing is 0.1999.',
                  },
                ]}
              />
              <Plot
                title="Expected monthly cost against p"
                x={{ label: 'p' }}
                y={{ label: 'dollars' }}
                series={[
                  { label: 'New plan', points: COST },
                  { label: 'Old plan', points: OLD_PLAN },
                ]}
                marks={[{ x: 0.2, y: 20, label: 'p ≈ 0.2' }]}
              />
              <Callout tone="caveat" title="A common slip">
                <p>
                  Don&apos;t compare the plans at one caller&apos;s{' '}
                  <MathInline tex="p" /> and then quote the answer for all
                  callers.
                </p>
              </Callout>
              <AnswersCard
                title="Answers"
                answers={[
                  {
                    label: '(a)',
                    children: (
                      <p>
                        <MathInline tex="E[C] = 15 + 1/p" />
                      </p>
                    ),
                  },
                  {
                    label: '(b)',
                    children: (
                      <p>
                        <MathInline tex="p > 0.2" /> (exactly 0.1999): under
                        five minutes a month
                      </p>
                    ),
                  },
                ]}
              />
            </div>
          </Shelf>
        </Pages>
        <Shelf label="a guide: eigenvalues, wide">
          <div className="w-panel-wide space-y-4 rounded-md border bg-rail p-card">
            <PartHeader first label="(a)" title="The eigenvalues of A" />
            <StepHeading
              number={1}
              title="Turn eigenvalues into a determinant"
            />
            <GuidePara>
              A nonzero <MathInline tex="v" /> with{' '}
              <MathInline tex="Av = \lambda v" /> exists exactly when{' '}
              <MathInline tex="A - \lambda I" /> sends some nonzero vector to
              zero, that is, when it is <strong>singular</strong>. So we need
            </GuidePara>
            <MathDisplay tex="\det(A - \lambda I) = 0" />
            <StepHeading number={2} title="Solve the characteristic equation" />
            <WorkedSteps
              steps={[
                {
                  math: '\\det\\begin{pmatrix} 2-\\lambda & 1 \\\\ 1 & 2-\\lambda \\end{pmatrix} = (2-\\lambda)^2 - 1',
                  why: 'The determinant of a 2 by 2 matrix is ad - bc.',
                },
                {
                  math: '(2-\\lambda)^2 - 1 = (\\lambda - 1)(\\lambda - 3)',
                  why: 'A difference of squares.',
                },
                {
                  math: '\\lambda = 1 \\quad\\text{or}\\quad \\lambda = 3',
                  why: 'A product is zero when a factor is.',
                },
              ]}
            />
            <Note>
              A quick check: the eigenvalues add to the trace,{' '}
              <MathInline tex="2 + 2 = 4" />, and multiply to the determinant,{' '}
              <MathInline tex="4 - 1 = 3" />.
            </Note>
            <PartHeader label="(b)" title="An eigenvector for each" />
            <StepHeading
              number={1}
              title="Find what each shifted matrix sends to zero"
            />
            <GuidePara>
              For each <MathInline tex="\lambda" />, an eigenvector is any
              nonzero solution of <MathInline tex="(A - \lambda I)v = 0" />.
            </GuidePara>
            <Callout tone="insight" title="Why they're perpendicular">
              <p>
                <MathInline tex="A" /> is symmetric, and a symmetric matrix
                always has perpendicular eigenvectors for different eigenvalues.
              </p>
            </Callout>
            <AnswersCard
              title="Answers"
              answers={[
                {
                  label: '(a)',
                  children: (
                    <p>
                      <MathInline tex="\lambda_1 = 1" /> and{' '}
                      <MathInline tex="\lambda_2 = 3" />.
                    </p>
                  ),
                },
                {
                  label: '(b)',
                  children: (
                    <p>
                      <MathInline tex="\lambda = 3" />:{' '}
                      <MathInline tex="v = (1, 1)" />.{' '}
                      <MathInline tex="\lambda = 1" />:{' '}
                      <MathInline tex="v = (1, -1)" />.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'document',
    title: 'Document',
    group: 'Document and transcript',
    note: "What the engine writes, as the page draws it: a document of blocks, text split into runs by the server (math, marks, citations), so nothing here parses anything. Ask's answer is compact at the panel's width; a guide reads at the reading size, with its hint, walkthrough and answers as three veiled stages, the tree built from its part and step markers (steps number from 1 in each part), and each answer in place at the end of its part. Math that would not parse, and a block that could not be made valid, show as their source, muted, never red. Pages are PDF pages, with the book's offset of 16.",
    Demo: () => (
      <>
        <Pages value={PageMap.single(16)}>
          <Shelf label="Ask's answer: every block type">
            <div
              id="document"
              className="w-panel space-y-3 rounded-md border bg-rail p-card text-base"
            >
              <Document blocks={BLOCKS} onJump={() => {}} />
            </div>
          </Shelf>
          <Shelf label="a guide: the hint, the walkthrough, the answers">
            <div className="w-panel-wide space-y-5 rounded-md border bg-rail p-card text-base">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">hint</p>
                <Document reading blocks={GUIDE_HINT} onJump={() => {}} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">
                  walkthrough
                </p>
                <Document reading blocks={GUIDE} onJump={() => {}} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">
                  answers
                </p>
                <AnswersOf blocks={GUIDE} onJump={() => {}} />
              </div>
            </div>
          </Shelf>
          <Shelf label="blocks being written: a paragraph streaming, a plot, worked steps, tidying">
            <div className="w-panel space-y-3 rounded-md border bg-rail p-card text-base">
              <BlockSkeleton
                type="para"
                runs={[
                  {
                    t: 'Each minute a caller talks ends the call with probability ',
                  },
                  { m: 'p' },
                  { t: ', so the length' },
                ]}
                repairing={false}
              />
              <BlockSkeleton type="para" repairing={false} />
              <BlockSkeleton type="step" repairing={false} />
              <BlockSkeleton type="plot" repairing={false} />
              <BlockSkeleton type="derivation" repairing />
            </div>
          </Shelf>
        </Pages>
      </>
    ),
  },
  {
    id: 'selection',
    title: 'Asking about a selection',
    group: 'Document and transcript',
    note: "Every element of a live document is selectable: hover washes it quietly, a click picks it, and a small toolbar on the outline asks about exactly it, the button naming what it points at. A derivation's lines select one by one; a part or step heading selects its whole group. The outline and the composer's chip are one state: the chip names the question and the place (an answer's selection is an excerpt), ✕ or Esc drops both, and the chip the sent turn keeps is an inert record. What the tutor receives is the whole problem plus the selection's exact text, snapshotted when picked.",
    docs: ['document'],
    Demo: () => (
      <Pages value={DEMO_PAGES}>
        <Shelf label="a guide that selects">
          <div className="w-panel-wide rounded-md border bg-rail p-card text-base">
            <SelectingDocument blocks={GUIDE} stage="walkthrough" />
          </div>
        </Shelf>
        <Shelf label="an answer that selects (the chip is an excerpt)">
          <div className="w-panel rounded-md border bg-rail p-card text-base">
            <SelectingDocument blocks={BLOCKS} stage="answer" />
          </div>
        </Shelf>
      </Pages>
    ),
  },
];
