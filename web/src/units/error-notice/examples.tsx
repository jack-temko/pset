import { defineExamples } from '@/design/examples';
import { TextField } from '@/units/text-field';
import { ErrorNotice } from './index';
import spec from './spec';

const NO_KEY = {
  what: "Couldn't answer: no OpenRouter key is saved.",
};

const NOT_FOUND = {
  what: "Couldn't find 3.A.4",
  why: [
    'Looked for "3.A.4" on pages 140 to 160',
    "Read the chapter's exercise list",
  ],
  chain: ['find.not_found', 'read.no_match'],
  incident: 'k7q2',
};

const DAMAGED = {
  what: "Couldn't read Circuits, 6th edition",
  why: 'The file ended before its last page, so it is probably damaged or only partly downloaded.',
  fix: 'If it fails again, add it again from a fresh copy.',
  chain: ['material.read', 'pdf.truncated'],
  incident: 'p3m9',
};

export default defineExamples(spec, ErrorNotice, {
  states: {
    line: () => (
      <ErrorNotice
        variant="line"
        error={{ what: "Couldn't answer: the model took too long to reply." }}
        actions={[{ label: 'Try again' }]}
      />
    ),
    'line-fix': () => (
      <ErrorNotice
        variant="line"
        error={NO_KEY}
        actions={[{ label: 'Open Settings' }]}
      />
    ),
    field: () => (
      <div className="w-[320px]">
        <TextField
          label="Name"
          value="ECE 210"
          onChange={() => undefined}
          failed
          note="That name is taken by another course."
        />
      </div>
    ),
    block: () => (
      <ErrorNotice
        error={NOT_FOUND}
        actions={[
          { label: 'Try again' },
          { label: 'Box it on the page' },
          { label: 'Paste the text' },
        ]}
      />
    ),
    details: () => (
      <ErrorNotice
        error={NOT_FOUND}
        actions={[{ label: 'Try again' }]}
        startDetails
      />
    ),
    pane: () => (
      <div className="flex h-[320px] w-full items-center justify-center bg-(--ds-bg) p-8 outline-[1px] outline-(--ds-border-muted)">
        <ErrorNotice error={DAMAGED} actions={[{ label: 'Read it again' }]} />
      </div>
    ),
  },
  stress: () => (
    <div className="w-[240px] space-y-6 outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <ErrorNotice
        variant="line"
        error={{
          what: "Couldn't save: the course name Introduction_to_Electrical_Circuits_and_Signals_Fall is too long.",
        }}
        actions={[{ label: 'Try again' }]}
      />
      <ErrorNotice
        error={{
          ...DAMAGED,
          what: "Couldn't read Fundamentals_of_Electric_Circuits_Alexander_Sadiku_6th.pdf",
        }}
        actions={[{ label: 'Read it again' }, { label: 'Remove it' }]}
      />
    </div>
  ),
});
