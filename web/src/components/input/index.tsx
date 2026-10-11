import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** The control border is `input`, deliberately darker than `border`: a
 *  field has to look like something you can type into. */
const field =
  'w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50';

/** A single-line control, including `type="date"`. The date picker is the
 *  browser's (the one control in the app we don't draw) because a
 *  correct, keyboard-reachable calendar is not worth rebuilding. */
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(field, 'h-control', className)} {...props} />;
}

/**
 * A field that starts one line tall and grows to fit what you type, so a
 * reference like "3.B.4" takes one line and a pasted statement takes four.
 * It never scrolls: the element's height follows its content.
 */
export function AutoTextarea({
  className,
  value,
  ...props
}: ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // The height follows the content. A textarea mounted hidden (the Ask tab
  // behind Homework) has no layout and a scrollHeight of 0: it keeps its natural
  // height until it is shown, and is fitted then (its width changes from 0).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      el.style.height = 'auto';
      if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn(field, 'resize-none overflow-hidden py-1', className)}
      {...props}
    />
  );
}

/** A label above a control, with an optional quiet hint under it, or,
 *  when something is wrong with the value, the error in its place. The
 *  label is a real `<label>`, so its text is part of the target. */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  /** Replaces the hint while set: one line under a field, never two. */
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-destructive">{error}</span>
      ) : (
        hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )
      )}
    </label>
  );
}
