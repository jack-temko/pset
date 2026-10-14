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
  path = [],
  settingsHref,
}: {
  path?: readonly PathItem[];
  settingsHref: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-(--ds-border-muted) bg-(--ds-bg) px-10">
      <nav className="flex min-w-0 items-center gap-2">
        <a
          href="/"
          className="shrink-0 font-(family-name:--ds-font-serif) text-xl font-medium text-(--ds-fg) underline-offset-2 hover:underline focus-visible:underline"
        >
          PSet
        </a>
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
                    className="min-w-0 truncate text-(--ds-fg-muted)!"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <Link href={settingsHref} className="shrink-0">
        Settings
      </Link>
    </header>
  );
}
