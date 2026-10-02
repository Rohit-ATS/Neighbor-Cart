import React, { useState, useEffect } from 'react';
import Landing from './screens/Landing.jsx';
import Places from './screens/Places.jsx';

export default function App() {
  const [view, setView] = useState(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path.includes('places') || hash.includes('places')) {
      return 'places';
    }
    return 'landing';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes('places') || hash.includes('places')) {
        setView('places');
      } else {
        setView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (nextView) => {
    setView(nextView);
    const targetUrl = nextView === 'places' ? '/places' : '/';
    if (window.location.pathname !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-root">
      {view === 'places' ? (
        <Places onNavigateHome={() => navigateTo('landing')} />
      ) : (
        <Landing onNavigatePlaces={() => navigateTo('places')} />
      )}
    </div>
  );
}
