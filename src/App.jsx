import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Landing from './components/Landing.jsx';
import Dashboard from './components/Dashboard.jsx';

const SLIDE_MS = 620;

export default function App() {
  const [view, setView] = useState('landing');
  const [leaving, setLeaving] = useState(null); // { view, dir } while sliding out
  const [active, setActive] = useState('top');
  const timer = useRef(null);
  const viewRef = useRef(view);

  useEffect(() => () => clearTimeout(timer.current), []);

  /* Swap views: the old one slides off, the new one slides in behind it. */
  const go = useCallback((next) => {
    const current = viewRef.current;
    if (current === next) return;
    viewRef.current = next;
    setLeaving({ view: current, dir: next === 'dashboard' ? 'left' : 'right' });
    setView(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), SLIDE_MS);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  function handleNavigate(item) {
    setActive(item.id);
    if (item.goesToDashboard) {
      go('dashboard');
      return;
    }
    if (view === 'dashboard') {
      go('landing');
      // let the landing mount before jumping to the anchor
      setTimeout(() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }), SLIDE_MS);
      return;
    }
    document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
  }

  const render = (which) =>
    which === 'dashboard'
      ? <Dashboard onBack={() => { setActive('top'); go('landing'); }} />
      : <Landing onStart={() => { setActive('start'); go('dashboard'); }} />;

  return (
    <>
      <Sidebar active={active} onNavigate={handleNavigate} />
      <main className="viewport">
        {leaving && (
          <div className={`view is-leaving leave-${leaving.dir}`} aria-hidden="true">
            {render(leaving.view)}
          </div>
        )}
        <div className={`view${leaving ? ` is-entering enter-${leaving.dir}` : ''}`} key={view}>
          {render(view)}
        </div>
      </main>
    </>
  );
}
