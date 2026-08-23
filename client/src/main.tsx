/**
 * main.tsx — where React takes over the page (step 7b).
 *
 * The only file that touches the DOM directly. Everything below App is React's.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';

const container = document.getElementById('root');

// getElementById returns null when nothing matches, and React would fail further
// in with a less useful message. The only way this happens is index.html losing
// its #root div, so name that.
if (!container) {
  throw new Error('main: index.html has no #root element to mount into.');
}

createRoot(container).render(
  // StrictMode is a development-only wrapper that deliberately mounts every
  // component twice, to surface effects that do not clean up after themselves.
  // It is why GET /api/words fires twice on a dev page load — see the note in
  // app.tsx. It does nothing at all in a production build.
  <StrictMode>
    <App />
  </StrictMode>,
);
