import React, { useState } from 'react';
import { navigate } from '../app/router.jsx';
import { BUDGETS, useStore } from '../app/store.jsx';
import { ONBOARDING_OPTIONS } from '../data/catalog.js';
import { Button, Chip, Icon, SafetyNote } from '../components/ui.jsx';
import CartMark from '../components/CartMark.jsx';

const STEPS = [
  { id: 'where', title: 'Where are you eating?', body: 'We only use this to rank places by distance from you.' },
  { id: 'allergies', title: 'Any allergies we should know about?', body: 'Pick everything that applies. You can change this at any time.' },
  { id: 'diet', title: 'How do you prefer to eat?', body: 'Dietary preferences and restrictions, including cultural ones.' },
  { id: 'goals', title: 'Anything you are working toward?', body: 'These shape which dishes we surface first. Not medical advice.' },
  { id: 'tastes', title: 'What do you love, and what do you skip?', body: 'The fun part. This is what makes recommendations feel like yours.' },
  { id: 'practical', title: 'Budget, household and distance', body: 'So results stay realistic for your week.' },
];

export default function Onboarding() {
  const { profile, updateProfile } = useStore();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(profile);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const toggle = (key, value) =>
    setDraft((d) => {
      const list = d[key] ?? [];
      return { ...d, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  const next = () => {
    if (!last) {
      setStep((s) => s + 1);
      return;
    }
    updateProfile({ ...draft, onboarded: true });
    navigate('/app');
  };

  const ChipGroup = ({ field, options }) => (
    <ul className="chip-grid">
      {options.map((o) => (
        <li key={o}>
          <Chip selected={(draft[field] ?? []).includes(o)} onClick={() => toggle(field, o)}>{o}</Chip>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="onboarding" id="main">
      <div className="onboard-card">
        <header className="onboard-head">
          <CartMark size={30} />
          <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <p className="mono">Step {step + 1} of {STEPS.length}</p>
        </header>

        <div className="onboard-body" key={current.id}>
          <h1>{current.title}</h1>
          <p className="onboard-sub">{current.body}</p>

          {current.id === 'where' && (
            <div className="field-row">
              <label className="field">
                <span>ZIP code</span>
                <input
                  value={draft.zip}
                  inputMode="numeric"
                  maxLength={5}
                  onChange={(e) => setDraft((d) => ({ ...d, zip: e.target.value.replace(/\D/g, '') }))}
                />
              </label>
              <label className="field">
                <span>City</span>
                <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
              </label>
            </div>
          )}

          {current.id === 'allergies' && (
            <>
              <ChipGroup field="allergies" options={ONBOARDING_OPTIONS.allergies} />
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={draft.seriousAllergy}
                  onChange={(e) => setDraft((d) => ({ ...d, seriousAllergy: e.target.checked }))}
                />
                <span className="switch" aria-hidden="true" />
                <span className="switch-text">
                  <b>One of these is a serious allergy</b>
                  <span>We will show cross-contact warnings more prominently and never mark a dish as safe on your behalf.</span>
                </span>
              </label>
              {draft.seriousAllergy && (
                <SafetyNote>
                  With serious allergies, treat every suggestion as a starting point. Confirm ingredients and
                  preparation with the restaurant or manufacturer before you eat.
                </SafetyNote>
              )}
            </>
          )}

          {current.id === 'diet' && <ChipGroup field="diets" options={ONBOARDING_OPTIONS.diets} />}
          {current.id === 'goals' && (
            <>
              <ChipGroup field="goals" options={ONBOARDING_OPTIONS.goals} />
              <SafetyNote compact>
                These are food preferences, not a care plan. Neighbor Cart does not give medical or nutritional advice.
              </SafetyNote>
            </>
          )}

          {current.id === 'tastes' && (
            <>
              <h2 className="sub-head">Favorites and cuisines</h2>
              <ChipGroup field="loves" options={ONBOARDING_OPTIONS.loves} />
              <h2 className="sub-head">Foods to avoid</h2>
              <ChipGroup field="avoid" options={ONBOARDING_OPTIONS.avoid} />
            </>
          )}

          {current.id === 'practical' && (
            <>
              <h2 className="sub-head">Budget per meal</h2>
              <ul className="chip-grid">
                {Object.entries(BUDGETS).map(([k, v]) => (
                  <li key={k}>
                    <Chip selected={draft.budget === k} onClick={() => setDraft((d) => ({ ...d, budget: k }))}>{v}</Chip>
                  </li>
                ))}
              </ul>

              <h2 className="sub-head">Preferred stores</h2>
              <ChipGroup field="stores" options={ONBOARDING_OPTIONS.stores} />

              <div className="field-row">
                <label className="field">
                  <span>Household size</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={draft.household}
                    onChange={(e) => setDraft((d) => ({ ...d, household: Number(e.target.value) }))}
                  />
                </label>
                <label className="field">
                  <span>Willing to travel: <b>{draft.distance} miles</b></span>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={draft.distance}
                    onChange={(e) => setDraft((d) => ({ ...d, distance: Number(e.target.value) }))}
                  />
                </label>
              </div>
            </>
          )}
        </div>

        <footer className="onboard-foot">
          <p className="privacy">
            <Icon name="user" size={15} />
            You control what you share. Your profile is used to personalize recommendations.
          </p>
          <div className="onboard-actions">
            {step > 0 && (
              <Button variant="quiet" size="md" onClick={() => setStep((s) => s - 1)}>Back</Button>
            )}
            <button type="button" className="text-link" onClick={() => { updateProfile({ onboarded: true }); navigate('/app'); }}>
              Skip for now
            </button>
            <Button variant="primary" size="md" icon="arrow" onClick={next}>
              {last ? 'See my food' : 'Continue'}
            </Button>
          </div>
        </footer>
      </div>
    </main>
  );
}
