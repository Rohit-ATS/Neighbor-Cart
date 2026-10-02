import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

/* Two renderers behind one component.

   Today this draws with Leaflet and OpenStreetMap tiles, which need no key.
   Set VITE_GOOGLE_MAPS_API_KEY in .env.local and it switches to Google Maps
   instead — the props below do not change. The Google loader is the async
   bootstrap pattern ported from DOCKET's lib/google-maps.ts. */
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let googleLoading;
function loadGoogleMaps(apiKey, onAuthFailure) {
  window.gm_authFailure = onAuthFailure;
  if (typeof google !== 'undefined' && google.maps) return Promise.resolve();
  googleLoading ??= new Promise((resolve, reject) => {
    window.__ncMapsReady = () => resolve();
    const params = new URLSearchParams({ key: apiKey, v: 'weekly', loading: 'async', callback: '__ncMapsReady' });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      googleLoading = undefined;
      script.remove();
      reject(new Error("Google Maps couldn't load. Check your connection and try again."));
    };
    document.head.append(script);
  });
  return googleLoading;
}

// Boundaries are stored [lng, lat] (GeoJSON order) while Leaflet wants [lat, lng].
const toLatLng = (ring) => ring.map(([lng, lat]) => [lat, lng]);
const NO_POINTS = [];

export default function MapView({
  label,
  boundary,
  points = NO_POINTS,
  activeId,
  radiusM = null,
  className = '',
  interactive = true,
  onSelect,
}) {
  const container = useRef(null);
  const leaflet = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef(new Map());
  const ring = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // read the handler through a ref so a new one doesn't tear the map down
  const select = useRef(onSelect);
  select.current = onSelect;

  /* Build once; the active site is applied by the effect below. */
  useEffect(() => {
    let cancelled = false;
    let map;

    // Leaflet touches window on import, so load it only in the browser.
    import('leaflet')
      .then((mod) => {
        const L = mod.default ?? mod;
        if (cancelled || !container.current) return;
        leaflet.current = L;
        map = L.map(container.current, {
          scrollWheelZoom: false,
          dragging: interactive,
          zoomControl: interactive,
          keyboard: interactive,
          doubleClickZoom: interactive,
          touchZoom: interactive,
        });
        mapRef.current = map;

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          className: 'nc-tiles',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        let bounds;
        const extend = (b) => (bounds = bounds ? bounds.extend(b) : b);

        if (boundary) {
          const layer = L.polygon(toLatLng(boundary), {
            color: '#2b5247',
            weight: 3,
            dashArray: '7 6',
            fillColor: '#5a9a4c',
            fillOpacity: 0.12,
          }).addTo(map);
          extend(layer.getBounds());
        }

        for (const site of points) {
          const marker = L.marker([site.lat, site.lng], {
            title: site.name,
            keyboard: false,
            icon: L.divIcon({ className: 'nc-pin', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
          })
            .bindTooltip(site.name, { direction: 'top', offset: [0, -14] })
            .addTo(map);
          marker.on('click', () => select.current?.(site.id));
          markers.current.set(site.id, marker);
          extend(L.latLngBounds([site.lat, site.lng], [site.lat, site.lng]));
        }

        if (bounds) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 15 });
        else map.setView([37.5485, -121.9886], 12);
        setReady(true);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      setReady(false);
      markers.current.clear();
      ring.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, [boundary, points, interactive]);

  /* Move the highlight, the range ring and the view to the active site. */
  useEffect(() => {
    const L = leaflet.current;
    const map = mapRef.current;
    if (!L || !map) return;

    for (const [id, marker] of markers.current) {
      marker.getElement()?.classList.toggle('is-active', id === activeId);
    }

    ring.current?.remove();
    ring.current = null;

    const marker = markers.current.get(activeId);
    if (!marker) return;

    if (radiusM) {
      ring.current = L.circle(marker.getLatLng(), {
        radius: radiusM,
        color: '#d4603c',
        weight: 2,
        fillColor: '#d4603c',
        fillOpacity: 0.09,
      }).addTo(map);
    }
    map.panTo(marker.getLatLng(), { animate: true, duration: 0.6 });
  }, [activeId, radiusM, points, ready]);

  if (failed) {
    return (
      <div className={`map-frame map-failed ${className}`} role="region" aria-label={label}>
        <p>The map couldn't load. The list below has every address and directions link.</p>
      </div>
    );
  }

  return (
    <div className={`map-frame ${className}`}>
      <div ref={container} role="region" aria-label={label} className="map-canvas" />
      {!ready && <div className="map-loading" aria-hidden="true"><span /><span /><span /></div>}
      {GOOGLE_KEY && <span className="sr-only">Google Maps key detected</span>}
    </div>
  );
}

export { loadGoogleMaps, GOOGLE_KEY };
