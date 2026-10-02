import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [39.5, -98.35]; // Geographical center of the contiguous US
const DEFAULT_ZOOM = 4;

const ICONS = {
  'food-bank': '🥫',
  'pantry': '🧺',
  'hot-meal': '🍲',
  'community-fridge': '🧊'
};

const COLORS = {
  'food-bank': '#e65100',
  'pantry': '#2e7d32',
  'hot-meal': '#c2185b',
  'community-fridge': '#0288d1'
};

export default function MapView({
  places = [],
  activeId = null,
  onSelectPlace,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const leafletRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import('leaflet').then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = mod.default ?? mod;
      leafletRef.current = L;

      // Clean up if already exists
      if (mapRef.current) {
        mapRef.current.remove();
      }

      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      // High-quality OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Force recalculation of map container size
      setTimeout(() => {
        if (!cancelled && mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 250);

      setMapLoaded(true);
    }).catch((err) => {
      console.error('Failed to load Leaflet:', err);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers whenever places change or map finishes loading
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !mapLoaded) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    places.forEach((place) => {
      const emoji = ICONS[place.type] || '📍';
      const color = COLORS[place.type] || '#18352d';
      const isActive = place.id === activeId;

      const iconHtml = `
        <div class="custom-map-pin ${isActive ? 'is-active' : ''}" style="--pin-color: ${color};">
          <span class="pin-symbol">${emoji}</span>
          <div class="pin-pulse"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: iconHtml,
        iconSize: [36, 46],
        iconAnchor: [18, 42],
        popupAnchor: [0, -40],
      });

      const marker = L.marker([place.lat, place.lng], {
        icon: customIcon,
        title: place.name,
      }).addTo(map);

      // Popup
      const popupContent = `
        <div class="map-popup-card">
          <img src="${place.images[0]}" alt="${place.name}" class="map-popup-img" />
          <div class="map-popup-info">
            <span class="map-popup-badge" style="background: ${color}20; color: ${color};">${place.typeLabel}</span>
            <h4 class="map-popup-title">${place.name}</h4>
            <p class="map-popup-addr">${place.address}, ${place.cityStateZip}</p>
            <p class="map-popup-hours">⏱ ${place.hoursSummary}</p>
            <button class="map-popup-btn" id="popup-btn-${place.id}">View Details & Inventory</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280, className: 'neighbor-cart-popup' });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${place.id}`);
        if (btn) {
          btn.onclick = () => onSelectPlace?.(place);
        }
      });

      marker.on('click', () => {
        onSelectPlace?.(place);
      });

      markersRef.current.set(place.id, marker);
      bounds.extend([place.lat, place.lng]);
    });

    if (places.length > 0 && !activeId) {
      if (places.length === 1) {
        map.setView([places[0].lat, places[0].lng], 13);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [places, mapLoaded]);

  // Handle activeId changes (fly to selected marker)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeId) return;

    const marker = markersRef.current.get(activeId);
    if (marker) {
      const latLng = marker.getLatLng();
      map.flyTo(latLng, 14, { duration: 1.2 });
      marker.openPopup();
    }
  }, [activeId]);

  return (
    <div className={`map-view-wrapper ${className}`}>
      <div ref={containerRef} className="real-map-container" />
      <div className="map-legend">
        <span><b style={{ color: '#e65100' }}>🥫</b> Food Bank</span>
        <span><b style={{ color: '#2e7d32' }}>🧺</b> Pantry</span>
        <span><b style={{ color: '#c2185b' }}>🍲</b> Hot Meals</span>
        <span><b style={{ color: '#0288d1' }}>🧊</b> 24/7 Fridge</span>
      </div>
    </div>
  );
}
