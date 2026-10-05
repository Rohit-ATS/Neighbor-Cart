import React, { useState } from 'react';

/* The link between the personalized plan and the navigator.

   The plan already reached the navigator — its details were merged into the
   remembered needs and, with consent, travelled to Bedrock. What was missing
   was any sign of it. Someone who filled in the intake had no way to tell that
   the answers were being used, and no way to stop them being used; someone who
   never filled it in was simply asked questions the product already knew how
   to ask properly.

   So this says which it is. With a plan: what is being applied, and a switch to
   stop applying it. Without one: the shortest version of the same questions —
   where you are, and what you need there — written straight into the same
   profile the intake writes, so there is one place this knowledge lives rather
   than two that can disagree. */

/* Each chip sets one field of the profile. Nothing here invents a field: these
   are the intake's own answers, in their shortest form, so a plan begun here
   and a plan begun there are the same object. */
const QUICK_NEEDS = [
  { id: 'today', label: 'Need food today', field: 'urgency', value: 'Needs food today' },
  { id: 'no-car', label: 'No car', field: 'transportation', value: 'Walking / nearby only' },
  { id: 'delivery', label: 'Need delivery', field: 'transportation', value: 'Home delivery needed' },
  { id: 'halal', label: 'Halal', field: 'dietary', value: 'Halal' },
  { id: 'vegetarian', label: 'Vegetarian', field: 'dietary', value: 'Vegetarian' },
  { id: 'gluten-free', label: 'Gluten-free', field: 'dietary', value: 'Gluten-Free' },
  { id: 'baby', label: 'Baby formula', field: 'dietary', value: 'Baby Formula / Infant Food' },
];

/* The plan in one line. Long enough to be checkable, short enough to be read
   at a glance — if it cannot be checked, the switch beside it is meaningless. */
const summarise = (profile) => [
  profile.location && `Near ${profile.location}`,
  profile.householdSize,
  profile.urgency,
  profile.transportation,
  ...(profile.dietary || []),
].filter(Boolean).join(' · ');

export default function AiPlanLink({ profile, active, onToggle, onSaveQuick, onOpenPlan }) {
  const [location, setLocation] = useState('');
  const [picked, setPicked] = useState([]);

  const toggleNeed = (id) => {
    setPicked((previous) => (previous.includes(id)
      ? previous.filter((item) => item !== id)
      : [...previous, id]));
  };

  /* The chips are folded into a profile the same shape the intake saves, so
     everything downstream — the remembered needs, the offline matcher, the
     catalogue sent to Bedrock — reads it without knowing where it came from. */
  const submitQuick = (event) => {
    event.preventDefault();
    const chosen = QUICK_NEEDS.filter((need) => picked.includes(need.id));
    if (!location.trim() && chosen.length === 0) return;

    const next = { location: location.trim(), dietary: [] };
    chosen.forEach((need) => {
      if (need.field === 'dietary') next.dietary.push(need.value);
      else next[need.field] = need.value;
    });
    onSaveQuick(next);
    setPicked([]);
  };

  if (profile) {
    return (
      <div className={`ai-plan-link${active ? ' is-active' : ''}`}>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          className="apl-toggle"
          onClick={() => onToggle(!active)}
        >
          <span className="apl-switch" aria-hidden="true"><i /></span>
          <span className="apl-copy">
            <b>{active ? 'Using your food plan' : 'Your food plan is set aside'}</b>
            <small>{active ? summarise(profile) : 'Answers ignore it until you switch it back on.'}</small>
          </span>
        </button>
        <button type="button" className="apl-edit" onClick={onOpenPlan}>Edit plan</button>
      </div>
    );
  }

  return (
    <form className="ai-plan-link is-empty" onSubmit={submitQuick}>
      <p className="apl-title">Tell me where you are and what you need</p>
      <p className="apl-hint">
        Without this I can only answer in general. Nothing here leaves your device unless you turn on sharing below.
      </p>

      <div className="apl-row">
        <input
          type="text"
          className="apl-location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="ZIP code or city — e.g. 94110, Fremont"
          aria-label="Your ZIP code or city"
        />
        <button type="submit" className="apl-save">Use this</button>
      </div>

      <div className="apl-chips" role="group" aria-label="What you need">
        {QUICK_NEEDS.map((need) => (
          <button
            key={need.id}
            type="button"
            className={`apl-chip${picked.includes(need.id) ? ' is-on' : ''}`}
            aria-pressed={picked.includes(need.id)}
            onClick={() => toggleNeed(need.id)}
          >
            {need.label}
          </button>
        ))}
      </div>

      <button type="button" className="apl-full" onClick={onOpenPlan}>
        Or build the full plan — four questions, and it saves your pickup options
      </button>
    </form>
  );
}
