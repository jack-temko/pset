import { useEffect, useState } from 'react';

import { Markdown } from '@/pages/gallery/markdown';
import { READMES, readmePath } from './readmes';

/** The READMEs of the components a section shows, one after another. */
export function Docs({ names }: { names: string[] }) {
  const [sources, setSources] = useState<string[] | null>(null);
  const key = names.join(',');

  useEffect(() => {
    let live = true;
    void Promise.all(names.map((n) => READMES[readmePath(n)]())).then((s) => {
      if (live) setSources(s);
    });
    return () => {
      live = false;
      setSources(null);
    };
    // `key` is the names, by value: a new array of the same names doesn't reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!sources) return null;
  return (
    <div className="space-y-section">
      {sources.map((s, i) => (
        <Markdown key={names[i]} source={s} />
      ))}
    </div>
  );
}
