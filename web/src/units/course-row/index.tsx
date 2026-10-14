/** "7 materials", "1 material", "No materials". */
export function count(n: number, one: string, many: string): string {
  if (n === 0) return `No ${many}`;
  return `${String(n)} ${n === 1 ? one : many}`;
}

/** One course on one line: opens the course, and only the course
 *  (course-row-d1). Narrower than 520 the two counts take less room. */
export function CourseRow({
  name,
  materials,
  sets,
  href,
}: {
  name: string;
  materials: number;
  sets: number;
  href: string;
}) {
  return (
    <a
      href={href}
      className="@container block h-11 min-w-0 border-b border-(--ds-border-muted) hover:bg-(--ds-hover)"
    >
      <span className="grid h-full grid-cols-[minmax(0,1fr)_92px_60px] items-center gap-3 px-4 @min-[520px]:grid-cols-[minmax(0,1fr)_120px_120px] @min-[520px]:gap-4">
        <span className="ds-body min-w-0 truncate font-medium text-(--ds-fg)">
          {name}
        </span>
        <span className="ds-small ds-tabular truncate text-right text-(--ds-fg-muted)">
          {count(materials, 'material', 'materials')}
        </span>
        <span className="ds-small ds-tabular truncate text-right text-(--ds-fg-muted)">
          {count(sets, 'set', 'sets')}
        </span>
      </span>
    </a>
  );
}
