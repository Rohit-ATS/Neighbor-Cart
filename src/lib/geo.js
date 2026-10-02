import { useCallback, useEffect, useState } from 'react';

const EARTH_RADIUS_MILES = 3958.8;
const ORIGIN_KEY = 'nc_last_known_origin';

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/* Straight-line distance. It is only ever a stand-in for the driving and
   transit distances Google returns; label it as such wherever it is shown. */
export function haversineMiles(from, to) {
  if (!from || !to) return null;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatMiles(miles) {
  if (miles == null || Number.isNaN(miles)) return null;
  if (miles < 0.2) return 'a few steps away';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/* The browser's own position, asked for only when someone presses the button.
   A silently prompted permission dialog is a bad way to meet a person who is
   already anxious about where their next meal comes from. */
export function useUserLocation() {
  const [origin, setOrigin] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(ORIGIN_KEY) || 'null');
      return saved && typeof saved.lat === 'number' && typeof saved.lng === 'number' ? saved : null;
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState(origin ? 'ready' : 'idle');

  useEffect(() => {
    if (origin) sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
  }, [origin]);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    setStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus('ready');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const clear = useCallback(() => {
    sessionStorage.removeItem(ORIGIN_KEY);
    setOrigin(null);
    setStatus('idle');
  }, []);

  return { origin, status, request, clear, setOrigin };
}
