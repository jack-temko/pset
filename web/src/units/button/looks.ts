export type ButtonVariant = 'primary' | 'default' | 'quiet' | 'danger';

const LOOKS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-(--ds-accent-solid) text-(--ds-on-accent) hover:bg-(--ds-accent-solid-hover) active:bg-(--ds-accent-solid-pressed)',
  default:
    'border-(--ds-border) bg-transparent text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)',
  quiet:
    'border-transparent bg-transparent text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)',
  danger:
    'border-transparent bg-(--ds-danger-solid) text-(--ds-on-danger) hover:bg-(--ds-danger-solid-hover) active:bg-(--ds-danger-solid-pressed)',
};

/** The colours of a variant, for a control that is a button without being one
 *  (a "..." menu's trigger), so the two never drift apart. */
export function buttonLook(variant: ButtonVariant): string {
  return LOOKS[variant];
}
