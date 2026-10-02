/* A small, device-local bridge between the intake and the AI navigator.
   It deliberately lives in sessionStorage: closing the browser session clears
   it, and the navigator only receives the details needed to tailor help. */

export const RESIDENT_PROFILE_KEY = 'harvestlink-resident-profile-v1';
export const RESIDENT_PROFILE_EVENT = 'harvestlink-resident-profile-updated';

const clean = (value, limit = 160) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

export function getResidentProfile() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESIDENT_PROFILE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return null;
    return {
      location: clean(saved.location),
      address: clean(saved.address),
      householdSize: clean(saved.householdSize, 48),
      urgency: clean(saved.urgency, 48),
      transportation: clean(saved.transportation, 48),
      dietary: Array.isArray(saved.dietary) ? saved.dietary.map((item) => clean(item, 96)).filter(Boolean).slice(0, 12) : [],
      otherNeed: clean(saved.otherNeed, 500),
    };
  } catch {
    return null;
  }
}

export function saveResidentProfile(profile) {
  const next = {
    location: clean(profile.location),
    address: clean(profile.address),
    householdSize: clean(profile.householdSize, 48),
    urgency: clean(profile.urgency, 48),
    transportation: clean(profile.transportation, 48),
    dietary: Array.isArray(profile.dietary) ? profile.dietary.map((item) => clean(item, 96)).filter(Boolean).slice(0, 12) : [],
    otherNeed: clean(profile.otherNeed, 500),
  };
  try {
    sessionStorage.setItem(RESIDENT_PROFILE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(RESIDENT_PROFILE_EVENT, { detail: next }));
  } catch {
    // Intake still works if the browser blocks session storage.
  }
  return next;
}

export function residentProfileFacts(profile) {
  if (!profile) return [];
  const facts = [];
  const add = (id, label) => { if (label && !facts.some((fact) => fact.id === id)) facts.push({ id, label }); };
  add('intake-location', profile.location && `Near ${profile.location}`);
  add('intake-household', profile.householdSize && `Household: ${profile.householdSize}`);
  add('intake-urgency', profile.urgency && `Food timing: ${profile.urgency}`);
  add('intake-transportation', profile.transportation && `Transportation: ${profile.transportation}`);
  profile.dietary?.forEach((diet) => add(`intake-diet:${diet.toLowerCase()}`, diet));
  add('intake-other', profile.otherNeed && `Other food requirement: ${profile.otherNeed}`);
  return facts;
}
