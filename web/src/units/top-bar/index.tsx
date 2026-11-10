import { Link } from '@/units/link';

export interface PathItem {
  label: string;
  /** The last item is where you are and has none. */
  href?: string;
}

/** The top of every screen: the wordmark (Home), where you are as a path of
 *  links, and Settings. Nothing moves the wordmark or Settings; a long path
 *  truncates, the middle items first (top-bar-d1). */
export function TopBar({
  homeHref,
  path = [],
  settingsHref,
  onSettings,
  edge = 'page',
}: {
  /** Where the wordmark goes: Home. A router can intercept it like any link. */
  homeHref: string;
  path?: readonly PathItem[];
  settingsHref: string;
  /** On the Settings screen itself: Settings shows as where you are, not a link. */
  onSettings?: boolean;
  /** Its side padding: the page gutter (40px), or 24px in the workspace, so
   *  the wordmark lines up with the tabs and the pane (top-bar-d2). */
  edge?: 'page' | 'workspace';
}) {
  return (
    <header
      className={`sticky top-0 z-10 flex h-(--ds-topbar) items-center justify-between gap-4 border-b border-(--ds-border-muted) bg-(--ds-bg) ${edge === 'workspace' ? 'px-6' : 'px-(--ds-gutter)'}`}
    >
      <nav className="flex min-w-0 items-center gap-2">
        <Link href={homeHref} tone="fg" size="brand" className="shrink-0">
          PSet
        </Link>
        <ol className="flex min-w-0 items-center gap-2">
          {path.map((item, i) => {
            const last = i === path.length - 1;
            const middle = i > 0 && !last;
            return (
              <li
                key={`${String(i)}-${item.label}`}
                className={`flex min-w-0 items-center gap-2 ${middle ? 'shrink-[4]' : 'shrink'}`}
              >
                <span className="text-(--ds-fg-muted)">/</span>
                {last || item.href === undefined ? (
                  <span
                    title={item.label}
                    className="ds-body min-w-0 truncate text-(--ds-fg)"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    title={item.label}
                    tone="muted"
                    className="min-w-0 truncate"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {onSettings ? (
        <span className="ds-body shrink-0 text-(--ds-fg-muted)">Settings</span>
      ) : (
        <Link href={settingsHref} className="shrink-0">
          Settings
        </Link>
      )}
    </header>
  );
}
