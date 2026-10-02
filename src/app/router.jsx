import { useEffect, useState } from 'react';

/* A hash router: real URLs, working back button, no dependency. */
export function parse(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  const [, head = '', tail = ''] = path.match(/^\/([^/]*)\/?(.*)$/) || [];
  return { path, head, tail };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function navigate(to, { replace = false } = {}) {
  const next = `#${to}`;
  if (window.location.hash === next) return;
  if (replace) window.history.replaceState(null, '', next);
  else window.location.hash = to;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/* Anchor that keeps middle-click and "open in new tab" working. */
export function Link({ to, children, className = '', ...rest }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
