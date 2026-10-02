import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'neighbor-cart:v1';

export const DEFAULT_PROFILE = {
  name: 'Maya',
  zip: '94539',
  city: 'Fremont, CA',
  onboarded: false,
  allergies: ['Peanuts', 'Lactose'],
  seriousAllergy: true,
  diets: ['Vegetarian-friendly'],
  goals: ['Balanced meals', 'High protein'],
  avoid: ['Very spicy'],
  loves: ['Thai', 'Mediterranean', 'Breakfast all day'],
  budget: 'under-20',
  household: 2,
  distance: 3,
  stores: ['Safeway', '99 Ranch Market'],
};

/* localStorage can throw in private windows, so every access is guarded. */
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* non-fatal: the app works, it just won't remember */
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [profile, setProfile] = useState(() => ({ ...DEFAULT_PROFILE, ...(read()?.profile ?? {}) }));
  const [saved, setSaved] = useState(() => read()?.saved ?? ['hearth-table', 'oat-milk-barista']);
  const [threads, setThreads] = useState(() => read()?.threads ?? []);

  useEffect(() => {
    write({ profile, saved, threads });
  }, [profile, saved, threads]);

  const toggleSaved = useCallback((id) => {
    setSaved((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }, []);

  const updateProfile = useCallback((patch) => {
    setProfile((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
  }, []);

  const value = useMemo(
    () => ({ profile, updateProfile, saved, toggleSaved, isSaved: (id) => saved.includes(id), threads, setThreads }),
    [profile, updateProfile, saved, toggleSaved, threads],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export const BUDGETS = {
  'under-10': 'Under $10',
  'under-20': '$10–20',
  'under-35': '$20–35',
  any: 'No limit',
};
