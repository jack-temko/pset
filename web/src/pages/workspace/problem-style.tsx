import { Button } from '@/components/button'
import { SegmentedControl } from '@/components/segmented-control'
import type { Form, Style, Where } from '@/api/gen/probnum'
import type { StyleChoice } from './book-numbering'
import { usePages } from '@/lib/pages'

const FORMS = [
  { value: 'chapter', label: '4.27' },
  { value: 'section', label: '2.1.4' },
  { value: 'local', label: '3.1 #7' },
] as const satisfies readonly { value: Form; label: string }[]

const WHERE = [
  { value: 'section', label: 'After each section' },
  { value: 'chapter', label: "At the chapter's end" },
] as const satisfies readonly { value: Where; label: string }[]

/** What a reference means in the chosen style, in a sentence. */
const MEANING: Record<Form, string> = {
  chapter: '"4.27" is chapter 4\'s problem 27: problems are numbered through each chapter.',
  section: '"2.1.4" is section 2.1\'s problem 4: the section is part of every problem\'s number.',
  local: '"3.1 #7" is section 3.1\'s problem 7: each section\'s problems start again at 1, printed as "7."',
}

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
  const example = style?.example && style.form === value.form ? style.example : undefined

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Problems are numbered like</legend>
      <SegmentedControl
        label="How problems are numbered"
        options={FORMS}
        value={value.form as Form}
        onChange={(form) => onChange({ ...value, form })}
      />
      {value.form === 'section' && (
        <SegmentedControl
          label="Where the problems are"
          options={WHERE}
          value={value.where}
          onChange={(where) => onChange({ ...value, where })}
        />
      )}
      {value.form && <p className="text-xs text-muted-foreground">{MEANING[value.form]}</p>}
      {example && (
        <p className="text-xs text-muted-foreground">
          In this book: {example.label}, on p. {pages.label(example.page)}.
        </p>
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
