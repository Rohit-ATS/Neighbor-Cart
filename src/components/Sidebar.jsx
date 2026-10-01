import React, { useRef, useState } from 'react';

const items = [
  { id: 'top', label: 'Home', icon: '⌂' },
  { id: 'how', label: 'Find food', icon: '⌖' },
  { id: 'navigator', label: 'My plan', icon: '✓' },
  { id: 'about', label: 'Navigator', icon: '✦' },
  { id: 'start', label: 'Dashboard', icon: '◉', goesToDashboard: true },
];

export default function Sidebar({ open, active, onNavigate }) {
  const [ripples, setRipples] = useState([]);
  const nextRipple = useRef(0);

  function handleClick(item, event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const id = nextRipple.current++;
    setRipples((list) => [
      ...list,
      { id, item: item.id, x: event.clientX - rect.left, y: event.clientY - rect.top },
    ]);
    setTimeout(() => setRipples((list) => list.filter((r) => r.id !== id)), 620);
    onNavigate(item);
  }

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="Primary" aria-hidden={!open} inert={!open}>
      <span className="sidebar-brand" aria-hidden="true">
        <i />
        <b />
      </span>

      <nav className="sidebar-nav">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`rail-item${active === item.id ? ' is-active' : ''}`}
            style={{ '--pop-delay': `${0.18 + i * 0.09}s` }}
            onClick={(e) => handleClick(item, e)}
          >
            <span className="rail-surface">
              <span className="rail-icon" aria-hidden="true">{item.icon}</span>
              {ripples
                .filter((r) => r.item === item.id)
                .map((r) => <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />)}
            </span>
            <span className="rail-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <span className="sidebar-foot" aria-hidden="true">NP</span>
    </aside>
  );
}
