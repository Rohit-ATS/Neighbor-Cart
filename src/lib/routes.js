/* GitHub Pages serves this project below /Neighbor-Cart/, while local Vite
   serves it at /. Build every in-app URL from Vite's configured base so the
   browser never leaves the deployed application. */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const appPath = (route = '') => {
  const suffix = String(route).replace(/^\/+/, '');
  return `${base}/${suffix}` || '/';
};

/* A hash route never reaches the static host, so it remains reload-safe on
   GitHub Pages without requiring server-side URL rewrites. */
export const appHash = (route) => `#/${String(route).replace(/^\/+/, '')}`;
