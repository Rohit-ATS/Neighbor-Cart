import React, { useEffect } from 'react';
import { useRoute } from './app/router.jsx';
import { StoreProvider } from './app/store.jsx';
import Sidebar from './components/Sidebar.jsx';
import Landing from './screens/Landing.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Chat from './screens/Chat.jsx';
import Explore from './screens/Explore.jsx';
import PlaceDetail from './screens/PlaceDetail.jsx';
import Saved from './screens/Saved.jsx';
import Profile from './screens/Profile.jsx';
import Safety from './screens/Safety.jsx';

/* Onboarding is a focused flow with its own framing. Every other screen,
   landing included, sits under the shared header. */
const BARE = new Set(['onboarding']);

function Screen({ head, tail }) {
  switch (head) {
    case '': return <Landing />;
    case 'onboarding': return <Onboarding />;
    case 'app': return <Dashboard />;
    case 'explore': return <Explore />;
    case 'chat': return <Chat query={new URLSearchParams(tail.split('?')[1] ?? '').get('q') ?? ''} />;
    case 'place': return <PlaceDetail id={tail} />;
    case 'saved': return <Saved />;
    case 'profile': return <Profile />;
    case 'safety': return <Safety />;
    default: return <Landing />;
  }
}

function Shell() {
  const route = useRoute();
  const [head, qs] = route.head.split('?');
  const tail = route.tail || qs ? `${route.tail}${qs ? `?${qs}` : ''}` : '';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route.path]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {!BARE.has(head) && <Sidebar head={head} />}
      <div className={`app-body${BARE.has(head) ? ' is-bare' : ''}`}>
        <div className="view" key={route.path}>
          <Screen head={head} tail={tail} />
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
