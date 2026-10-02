const SESSION_KEY = 'nc_anonymous_device_session';

function deviceSession() {
  let value = localStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID().replaceAll('-', '');
    localStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'X-Neighbor-Session': deviceSession(),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
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
  const body = await request('/api/v1/locations');
  return body.locations;
}
