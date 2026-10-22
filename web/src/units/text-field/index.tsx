import { useId, type ReactNode } from 'react';

/** A labelled one-line input (text-field-d1). It tells the parent when the
 *  student commits (Enter, or leaving the field), so a field can save without a
 *  button. The line under it always has its height, so a note appearing or
 *  going never moves what is below. */
export function TextField({
  label,
  value,
  onChange,
  onCommit,
  placeholder,
  mono,
  secret,
  failed,
  note,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter, or the field losing focus. */
  onCommit?: (value: string) => void;
  placeholder?: string;
  /** Fixed-width type, for a key or a path. */
  mono?: boolean;
  /** Hides what is typed, as a password field does. */
  secret?: boolean;
  /** Draws the field and its note in the danger colour. */
  failed?: boolean;
  /** The line under the field: "Saved", or why it failed. */
  note?: ReactNode;
  /** A control at the field's right, such as Test. */
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="ds-small mb-1 block text-(--ds-fg-muted)">
        {label}
      </label>
      <div className="flex min-w-0 items-start gap-2">
        <input
          id={id}
          type={secret ? 'password' : 'text'}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onBlur={(e) => onCommit?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit?.(e.currentTarget.value);
          }}
          className={`h-(--ds-control) min-w-0 flex-1 rounded-(--ds-radius-control) border bg-(--ds-bg-inset) px-3 text-(--ds-fg) placeholder:text-(--ds-fg-muted) ${mono ? 'ds-code' : 'ds-body'} ${failed ? 'border-(--ds-danger)' : 'border-(--ds-border)'}`}
        />
        {action !== undefined && <div className="shrink-0">{action}</div>}
      </div>
      <p
        className={`ds-small min-h-5 pt-1 ${failed ? 'text-(--ds-danger)' : 'text-(--ds-fg-muted)'}`}
      >
        {note}
      </p>
    </div>
  );
}
