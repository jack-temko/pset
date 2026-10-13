import { lazy, Suspense } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';

import { useEventStream } from '@/api/events';
// Each feature registers what its events do to the cache on load.
import '@/api/library';
import '@/api/homework';
import '@/api/ask';
import '@/api/memory';
import { Home } from '@/pages/home';
import { Settings } from '@/pages/settings';
import { Errors as ErrorCatalog } from '@/pages/errors';
import { Workspace } from '@/pages/workspace';

// The galleries are big (every component's section, every view's mock) and the
// product never opens them: they load when their route does, so the first
// paint of Home or a book doesn't parse them.
const Components = lazy(() =>
  import('@/pages/components').then((m) => ({ default: m.Components })),
);
const Views = lazy(() =>
  import('@/pages/views').then((m) => ({ default: m.Views })),
);

const ThemeMock = lazy(() =>
  import('@/pages/theme-mock').then((m) => ({ default: m.ThemeMock })),
);

const Design = lazy(() =>
  import('@/pages/design').then((m) => ({ default: m.Design })),
);

/** The product's screens hold the live stream open. The gallery routes
 *  don't: a component or a view never talks to a real server. */
function Live() {
  useEventStream();
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Live />}>
          <Route path="/" element={<Home />} />
          <Route path="/books/:id" element={<Workspace />} />
          {/* Home's due list lands straight in a set's walkthrough. */}
          <Route path="/books/:id/homework/:homework" element={<Workspace />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        {/* Not in the nav: where you look at what a change did. */}
        <Route
          path="/components/:section?"
          element={
            <Suspense>
              <Components />
            </Suspense>
          }
        />
        <Route
          path="/views/:view?"
          element={
            <Suspense>
              <Views />
            </Suspense>
          }
        />
        <Route path="/errors/:section?" element={<ErrorCatalog />} />
        {/* Throwaway: mocks for the theme grill (ideas/theme-mocks.md). */}
        <Route
          path="/theme-mock/:screen"
          element={
            <Suspense>
              <ThemeMock />
            </Suspense>
          }
        />
        {/* The design system: one typed spec per unit, rendered. */}
        <Route
          path="/design/*"
          element={
            <Suspense>
              <Design />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
