import { Button } from '@/components/button'
import { RadioRows } from '@/components/radio-rows'
import { SegmentedControl } from '@/components/segmented-control'
import type { Form, Style, Where } from '@/api/gen/probnum'
import type { StyleChoice } from './book-numbering'
import { usePages } from '@/lib/pages'

/** Each way a book numbers its problems, spelled out: the labels alone
 *  mean nothing until you know which is which. */
const FORMS = [
  { value: 'chapter', label: '4.27', hint: "Numbered through each chapter: chapter 4's problem 27." },
  { value: 'section', label: '2.1.4', hint: "The section is part of every number: section 2.1's problem 4." },
  {
    value: 'local',
    label: '3.1 #7',
    hint: 'Each section\'s problems start again at 1, printed as "7.", so a reference names the section too.',
  },
] as const satisfies readonly { value: Form; label: string; hint: string }[]

const WHERE = [
  { value: 'section', label: 'After each section' },
  { value: 'chapter', label: "At the chapter's end" },
] as const satisfies readonly { value: Where; label: string }[]

/**
 * How the book numbers its problems, which decides what a reference like
 * "3.1 #7" means in it. Worked out at import from the book's own text;
 * when that wasn't plain, it says so and asks you to check. Spec:
 * design/workspace.md, "The book".
 */
export function ProblemStyleField({
  style,
  value,
  onChange,
  onConfirm,
  confirmed,
}: {
  /** As the engine has it. */
  style: Style | undefined
  value: StyleChoice
  onChange: (next: StyleChoice) => void
  /** Takes the detected style as right, unchanged. */
  onConfirm: () => void
  /** Whether it's been confirmed in this dialog. */
  confirmed: boolean
}) {
  const pages = usePages()
  const unsure = !style?.form || (!style.sure && !style.confirmed)
  const example = style?.example

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Problems are numbered like</legend>
      <RadioRows
        label="How problems are numbered"
        options={FORMS.map((f) => ({
          ...f,
          label: <span className="font-mono">{f.label}</span>,
          // What import found, shown on the option it found.
          hint:
            example && f.value === style?.form ? (
              <>
                {f.hint}
                <span className="block">
                  In this book: {example.label}, on p. {pages.label(example.page)}.
                </span>
              </>
            ) : (
              f.hint
            ),
        }))}
        value={value.form}
        onChange={(form) => onChange({ ...value, form })}
      />
      {value.form === 'section' && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Where the book keeps them</p>
          <SegmentedControl
            label="Where the problems are"
            options={WHERE}
            value={value.where}
            onChange={(where) => onChange({ ...value, where })}
          />
        </div>
      )}
      {unsure && !confirmed && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-warning">
            {style?.form
              ? "PSet couldn't tell for sure from the book's text. Check it against a problem page."
              : "PSet couldn't tell how this book numbers its problems. Pick the one it uses."}
          </p>
          {style?.form && (
            <Button variant="ghost" size="sm" className="shrink-0" onClick={onConfirm}>
              It's right
            </Button>
          )}
        </div>
      )}
    </fieldset>
  )
}
