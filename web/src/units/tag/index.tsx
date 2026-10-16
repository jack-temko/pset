import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type TagTone = 'neutral' | 'attention' | 'danger';

const TONES: Record<TagTone, string> = {
  neutral: 'border-(--ds-border) text-(--ds-fg-muted)',
  attention: 'border-(--ds-attention) text-(--ds-attention)',
  danger: 'border-(--ds-danger) text-(--ds-danger)',
};

/** A GitHub-style label: an outlined pill in its tone's colour (tag-d4). Names a fact about a thing. Never clickable, never focusable (tag-d1). */
export function Tag({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: TagTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={`ds-label inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-full border border-solid bg-transparent px-2 whitespace-nowrap ${TONES[tone]}`}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
