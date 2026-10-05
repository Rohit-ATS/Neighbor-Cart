import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import Landing from './screens/Landing.jsx';
import Places from './screens/Places.jsx';
import PageTransition from './components/PageTransition.jsx';
import { appPath } from './lib/routes.js';

/* The curtain closes in 460ms; the swap happens at COVER_MS, once it is fully
   closed, and it lifts shortly after. The gap between the two is what gives the
   brand mark time to be read rather than flashing past — at 520ms it reached
   full opacity barely 90ms before the reveal began. */
const COVER_MS = 600;

const viewFromUrl = () => {
  const { pathname, hash } = window.location;
  return pathname.includes('places') || hash.includes('places') ? 'places' : 'landing';
};

const CURTAIN_LABEL = {
  places: 'Finding food near you',
  landing: 'Back to the start',
};

export default function App() {
  const [view, setView] = useState(viewFromUrl);
  const [curtain, setCurtain] = useState(null);   // the view being travelled to
  /* Where the next page should land: a workspace panel id, or a landing
     section to scroll to. The search dock sets it from either page. */
  const [target, setTarget] = useState(null);
  const timers = useRef([]);
  const reduceMotion = useReducedMotion();

  // A navigation left half-finished would leave the curtain stuck over the
  // page, so every pending step is dropped when this unmounts.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const show = useCallback((next) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPopState = () => show(viewFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [show]);

  const navigateTo = useCallback((next, to = null) => {
    if (curtain) return;
    setTarget(to);
    if (next === view) return;

    const url = next === 'places' ? appPath('places') : appPath();
    if (window.location.pathname !== url) window.history.pushState(null, '', url);

    /* Someone who has asked for less motion still gets the navigation, just
       without the travel: no curtain, no smooth scroll. */
    if (reduceMotion) { show(next); return; }

    setCurtain(next);
    timers.current.forEach(clearTimeout);
    timers.current = [
      // Swap underneath while the curtain is closed...
      setTimeout(() => show(next), COVER_MS),
      // ...then let it carry on upward and reveal the new page.
      setTimeout(() => setCurtain(null), COVER_MS + 120),
    ];
  }, [view, curtain, reduceMotion, show]);

  return (
    <div className="app-root">
      {view === 'places' ? (
        <Places
          onNavigateHome={(section) => navigateTo('landing', section)}
          initialPanel={target}
          onPanelOpened={() => setTarget(null)}
        />
      ) : (
        <Landing
          onNavigatePlaces={(panel) => navigateTo('places', panel)}
          initialScrollTo={target}
          onScrolled={() => setTarget(null)}
        />
      )}

      <PageTransition active={Boolean(curtain)} label={curtain ? CURTAIN_LABEL[curtain] : null} />
    </div>
  );
}
