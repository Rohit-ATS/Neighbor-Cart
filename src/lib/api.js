const SESSION_KEY = 'nc_anonymous_device_session';
let sessionPromise = null;

async function deviceSession() {
  const cached = localStorage.getItem(SESSION_KEY);
  if (cached) return cached;

  if (!sessionPromise) {
    sessionPromise = fetch('/api/v1/sessions', { method: 'POST' })
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

export async function listLocations() {
  const body = await request('/api/v1/locations', {}, false);
  return body.locations;
}

export async function getLocationAvailability(locationId, pickupDate) {
  const params = new URLSearchParams({ date: pickupDate });
  const body = await request(`/api/v1/locations/${encodeURIComponent(locationId)}/availability?${params}`, {}, false);
  return body.availability;
}

export async function askHarvestLink(payload) {
  return request('/api/v1/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
