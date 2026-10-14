import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type TagTone = 'neutral' | 'attention';

const TONES: Record<TagTone, string> = {
  neutral: 'bg-(--ds-neutral-soft) text-(--ds-fg)',
  attention: 'bg-(--ds-attention-soft) text-(--ds-attention)',
};

/** Names a fact about a thing. Never clickable, never focusable (tag-d1). */
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
      className={`ds-small inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-(--ds-radius-tag) px-2 whitespace-nowrap ${TONES[tone]}`}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
