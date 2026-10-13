import { MoreHorizontal } from 'lucide-react';

import { IconButton } from '@/components/button';
import { Skeleton } from '@/components/skeleton';

/** A fixture for the design page, not a product component: a list row with
 *  a title, a second line and a menu. */
export function SampleRow({
  title,
  detail,
  menuOpen,
  failed,
}: {
  title: string;
  detail: string;
  menuOpen?: boolean;
  failed?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center gap-3 px-card py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p
            className={
              failed
                ? 'truncate text-xs text-destructive'
                : 'truncate text-xs text-muted-foreground'
            }
          >
            {detail}
          </p>
        </div>
        <IconButton variant="ghost" aria-label="More">
          <MoreHorizontal />
        </IconButton>
      </div>
      {menuOpen && (
        <ul className="border-t px-card py-1 text-sm">
          <li className="py-1">Open</li>
          <li className="py-1 text-destructive">Delete</li>
        </ul>
      )}
    </div>
  );
}

/** The row while its item loads: the same two lines and the button. */
export function SampleRowSkeleton() {
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center gap-3 px-card py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Skeleton className="h-4 w-1/2" />
          </p>
          <p className="text-xs">
            <Skeleton className="h-3 w-1/3" />
          </p>
        </div>
        <Skeleton className="size-control" />
      </div>
    </div>
  );
}
