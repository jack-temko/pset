import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';

/** A labelled one-line input (text-field-d1). It tells the parent when the
 *  student commits (Enter, or leaving the field with a changed value), so a
 *  field can save without a button. The line under it holds its height unless
 *  the field has none (`note={false}`), so a note appearing never moves what
 *  is below. */
export function TextField({
  label,
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  mono,
  secret,
  failed,
  note,
  action,
  inline,
  autoFocus,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter, or the field losing focus with a value that changed. */
  onCommit?: (value: string) => void;
  /** Escape: leave the field without committing. */
  onCancel?: () => void;
  placeholder?: string;
  /** Fixed-width type, for a key or a path. */
  mono?: boolean;
  /** Hides what is typed, as a password field does. */
  secret?: boolean;
  /** Draws the field and its note in the danger colour. */
  failed?: boolean;
  /** The line under the field: "Saved", or why it failed. `false` leaves the line out. */
  note?: ReactNode;
  /** A control at the field's right, such as Test. */
  action?: ReactNode;
  /** Sits in a row's title or a heading: no visible label or note, and as
   *  tall as the text it replaces. */
  inline?: 'row' | 'heading';
  /** Focuses and selects the value when it appears. */
  autoFocus?: boolean;
  /** Wraps and grows as you type, as tall as its text: Enter commits, Shift+Enter
   *  adds a line. For a value that is a sentence or more. */
  multiline?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  /** The last value committed, so Enter then blur commits once. */
  const committed = useRef(value);
  const left = useRef(false);

  useEffect(() => {
    if (!autoFocus) return;
    input.current?.focus();
    input.current?.select();
  }, [autoFocus]);

  useLayoutEffect(() => {
    const el = input.current;
    if (!multiline || !el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${String(el.scrollHeight + 2)}px`;
    };
    fit();
    // The width can change after the first paint (fonts, the stage), and the
    // wrapped height with it.
    if (typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, [multiline, value]);

  const commit = (v: string) => {
    if (v === committed.current) return;
    committed.current = v;
    onCommit?.(v);
  };

  const size =
    inline === 'row'
      ? multiline
        ? 'ds-body px-2 font-medium -mx-[9px] -my-px w-[calc(100%+18px)] flex-none'
        : 'ds-body h-6 px-2 font-medium'
      : inline === 'heading'
        ? 'ds-display h-(--ds-display-line) px-2'
        : `${multiline ? 'min-h-(--ds-control) py-[3px]' : 'h-(--ds-control)'} px-3 ${mono ? 'ds-code' : 'ds-body'}`;
  const bare = inline !== undefined;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={
          bare ? 'sr-only' : 'ds-small mb-1 block text-(--ds-fg-muted)'
        }
      >
        {label}
      </label>
      <div className="flex min-w-0 items-start gap-2">
        {multiline ? (
          <textarea
            ref={input}
            id={id}
            rows={1}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onBlur={(e) => {
              if (left.current) return;
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit(e.currentTarget.value);
              }
              if (e.key === 'Escape' && onCancel) {
                e.stopPropagation();
                left.current = true;
                onCancel();
              }
            }}
            className={`block min-w-0 flex-1 resize-none overflow-hidden rounded-(--ds-radius-control) border bg-(--ds-bg-inset) text-(--ds-fg) placeholder:text-(--ds-fg-muted) ${size} ${failed ? 'border-(--ds-danger)' : 'border-(--ds-border)'}`}
          />
        ) : (
          <input
            ref={input}
            id={id}
            type={secret ? 'password' : 'text'}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onBlur={(e) => {
              if (left.current) return;
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(e.currentTarget.value);
              if (e.key === 'Escape' && onCancel) {
                e.stopPropagation();
                left.current = true;
                onCancel();
              }
            }}
            className={`min-w-0 flex-1 rounded-(--ds-radius-control) border bg-(--ds-bg-inset) text-(--ds-fg) placeholder:text-(--ds-fg-muted) ${size} ${failed ? 'border-(--ds-danger)' : 'border-(--ds-border)'}`}
          />
        )}
        {action !== undefined && <div className="shrink-0">{action}</div>}
      </div>
      {!bare && note !== false && (
        <p
          className={`ds-small min-h-5 pt-1 ${failed ? 'text-(--ds-danger)' : 'text-(--ds-fg-muted)'}`}
        >
          {note}
        </p>
      )}
    </div>
  );
}
