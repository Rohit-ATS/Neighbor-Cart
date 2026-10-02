import React, { useState } from 'react';
import { Link } from '../app/router.jsx';
import { BUDGETS, DEFAULT_PROFILE, useStore } from '../app/store.jsx';
import { ONBOARDING_OPTIONS } from '../data/catalog.js';
import { Button, Chip, Icon, SafetyNote, SectionHead } from '../components/ui.jsx';

export default function Profile() {
  const { profile, updateProfile, saved } = useStore();
  const [note, setNote] = useState('');

  const toggle = (key, value) =>
    updateProfile((p) => {
      const list = p[key] ?? [];
      return { [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  const flash = (text) => {
    setNote(text);
    setTimeout(() => setNote(''), 2400);
  };

  const Group = ({ field, options, title, hint }) => (
    <section className="profile-section">
      <h2>{title}</h2>
      {hint && <p className="quiet-note">{hint}</p>}
      <ul className="chip-grid">
        {options.map((o) => (
          <li key={o}>
            <Chip selected={(profile[field] ?? []).includes(o)} onClick={() => toggle(field, o)}>{o}</Chip>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="profile-page" id="main">
      <div className="shell narrow">
        <header className="page-head">
          <p className="mono">Profile</p>
          <h1>Your food profile, <em className="serif">in your hands.</em></h1>
          <p className="page-sub">
            Everything here shapes what you see. Change it whenever your week changes —
            {' '}{saved.length} saved {saved.length === 1 ? 'item' : 'items'} keep their notes either way.
          </p>
        </header>

        <section className="profile-section">
          <h2>Where you are</h2>
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} />
            </label>
            <label className="field">
              <span>ZIP code</span>
              <input
                value={profile.zip}
                inputMode="numeric"
                maxLength={5}
                onChange={(e) => updateProfile({ zip: e.target.value.replace(/\D/g, '') })}
              />
            </label>
            <label className="field">
              <span>City</span>
              <input value={profile.city} onChange={(e) => updateProfile({ city: e.target.value })} />
            </label>
          </div>
        </section>

        <Group field="allergies" options={ONBOARDING_OPTIONS.allergies} title="Allergies" />

        <section className="profile-section">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={profile.seriousAllergy}
              onChange={(e) => updateProfile({ seriousAllergy: e.target.checked })}
            />
            <span className="switch" aria-hidden="true" />
            <span className="switch-text">
              <b>Serious allergy mode</b>
              <span>Cross-contact warnings stay visible on every card, and nothing is ever marked safe on your behalf.</span>
            </span>
          </label>
          {profile.seriousAllergy && (
            <SafetyNote compact>
              Always verify ingredients and preparation directly with the restaurant or manufacturer.
            </SafetyNote>
          )}
        </section>

        <Group field="diets" options={ONBOARDING_OPTIONS.diets} title="Dietary preferences" />
        <Group
          field="goals"
          options={ONBOARDING_OPTIONS.goals}
          title="What you are working toward"
          hint="Food preferences, not a care plan. Neighbor Cart does not give medical advice."
        />
        <Group field="loves" options={ONBOARDING_OPTIONS.loves} title="Favorites and cuisines" />
        <Group field="avoid" options={ONBOARDING_OPTIONS.avoid} title="Foods to avoid" />
        <Group field="stores" options={ONBOARDING_OPTIONS.stores} title="Preferred stores" />

        <section className="profile-section">
          <h2>Budget and range</h2>
          <ul className="chip-grid">
            {Object.entries(BUDGETS).map(([k, v]) => (
              <li key={k}><Chip selected={profile.budget === k} onClick={() => updateProfile({ budget: k })}>{v}</Chip></li>
            ))}
          </ul>
          <div className="field-row">
            <label className="field">
              <span>Household size</span>
              <input
                type="number"
                min={1}
                max={12}
                value={profile.household}
                onChange={(e) => updateProfile({ household: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Willing to travel: <b>{profile.distance} miles</b></span>
              <input
                type="range"
                min={1}
                max={15}
                value={profile.distance}
                onChange={(e) => updateProfile({ distance: Number(e.target.value) })}
              />
            </label>
          </div>
        </section>

        <section className="profile-section">
          <SectionHead eyebrow="Privacy" title="Your data" />
          <p>
            This demo keeps your profile in your own browser. Nothing is sent anywhere, and clearing it
            removes every preference we hold.
          </p>
          <div className="profile-actions">
            <Button variant="quiet" size="md" onClick={() => { updateProfile(DEFAULT_PROFILE); flash('Profile reset to the demo defaults.'); }}>
              Reset to defaults
            </Button>
            <Button
              variant="quiet"
              size="md"
              onClick={() => {
                try { localStorage.removeItem('neighbor-cart:v1'); } catch { /* ignore */ }
                updateProfile({ ...DEFAULT_PROFILE, onboarded: false });
                flash('Local data cleared.');
              }}
            >
              Clear local data
            </Button>
            <Link to="/safety" className="text-link">How we handle allergens <Icon name="arrow" size={15} /></Link>
          </div>
          {note && <p className="flash" role="status">{note}</p>}
        </section>
      </div>
    </main>
  );
}
