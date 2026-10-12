import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';

import { useEventStream } from '@/api/events';
// Each feature registers what its events do to the cache on load.
import '@/api/library';
import '@/api/homework';
import '@/api/ask';
import '@/api/memory';
import { Components } from '@/pages/components';
import { Home } from '@/pages/home';
import { Settings } from '@/pages/settings';
import { Errors as ErrorCatalog } from '@/pages/errors';
import { Views } from '@/pages/views';
import { Workspace } from '@/pages/workspace';

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
        <Route path="/components/:section?" element={<Components />} />
        <Route path="/views/:view?" element={<Views />} />
        <Route path="/errors/:section?" element={<ErrorCatalog />} />
      </Routes>
    </BrowserRouter>
  );
}
