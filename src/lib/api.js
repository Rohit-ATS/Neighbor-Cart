const SESSION_KEY = 'nc_anonymous_device_session';
let sessionPromise = null;

async function deviceSession() {
  const cached = localStorage.getItem(SESSION_KEY);
  if (cached) return cached;

  if (!sessionPromise) {
    // JSON makes session bootstrap a non-simple browser request, so an
    // unrelated site cannot spend this network's anonymous-session quota with
    // a plain HTML form submission.
    sessionPromise = fetch('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || typeof body.session?.id !== 'string') {
          throw new Error(body.error || 'Unable to start a private session. Please try again.');
        }
        localStorage.setItem(SESSION_KEY, body.session.id);
        return body.session.id;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

async function request(path, options = {}, requiresSession = true, retryAfterExpiredSession = true) {
  const headers = { ...options.headers };
  if (requiresSession) headers['X-Neighbor-Session'] = await deviceSession();
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && requiresSession && retryAfterExpiredSession) {
    localStorage.removeItem(SESSION_KEY);
    return request(path, options, true, false);
  }
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

export async function createReservation(payload) {
  const idempotencyKey = crypto.randomUUID().replaceAll('-', '');
  const body = await request('/api/v1/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  return body.reservation;
}

export async function listReservations() {
  const body = await request('/api/v1/reservations');
  return body.reservations;
}

/**
 * Locations, optionally near a point. The directory is nationwide, so an
 * unfiltered call returns only the first page the server is willing to send —
 * pass { lat, lng } to get the places someone can actually walk or drive to.
 */
export async function listLocations({ lat, lng, radiusKm, limit, category, q } = {}) {
  const params = new URLSearchParams();
  if (typeof lat === 'number' && typeof lng === 'number') {
    params.set('lat', String(lat));
    params.set('lng', String(lng));
  }
  if (radiusKm) params.set('radiusKm', String(radiusKm));
  if (limit) params.set('limit', String(limit));
  if (category && category !== 'all') params.set('category', category);
  if (q) params.set('q', q);

  const suffix = params.toString() ? `?${params}` : '';
  const body = await request(`/api/v1/locations${suffix}`, {}, false);
  return { places: body.locations, total: body.total ?? body.locations.length };
}

/** The visitor's coordinates, or null when unavailable or declined. */
export function currentPosition({ timeout = 8000 } = {}) {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null), // denial is a normal outcome, not an error to surface
      { timeout, maximumAge: 300_000 },
    );
  });
}

export async function getLocationAvailability(locationId, pickupDate) {
  const params = new URLSearchParams({ date: pickupDate });
  const body = await request(`/api/v1/locations/${encodeURIComponent(locationId)}/availability?${params}`, {}, false);
  return body.availability;
}

/* Google ratings, reviews, and travel time, fetched through our own API so the
   Maps key stays server-side. Returns `provider: 'none'` until a key is set. */
export async function enrichPlaces(payload) {
  return request('/api/v1/places/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function askHarvestLink(payload) {
  return request('/api/v1/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Everything Google lists around a point. Fetched live per area rather than
 * stored, because Google's terms forbid keeping a copy of their catalogue.
 * Returns `{ places: [], provider: 'none' }` when no API key is configured.
 */
export async function discoverPlaces({ lat, lng, radiusM = 25000, googlePlacesConsent = false }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusM: String(radiusM),
    googlePlacesConsent: String(googlePlacesConsent),
  });
  return request(`/api/v1/places/discover?${params}`, {}, false);
}
