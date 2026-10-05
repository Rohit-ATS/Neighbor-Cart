/* GitHub Pages serves this project below /Neighbor-Cart/, while local Vite
   serves it at /. Build every in-app URL from Vite's configured base so the
   browser never leaves the deployed application. */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const appPath = (route = '') => {
  const suffix = String(route).replace(/^\/+/, '');
  return `${base}/${suffix}` || '/';
};
