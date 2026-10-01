import React from 'react';

const stats = [
  { label: 'Sites near you', value: '12', note: 'open this week' },
  { label: 'Benefits matched', value: '3', note: 'ready to apply' },
  { label: 'Plan progress', value: '40%', note: '2 of 5 steps done' },
];

const plan = [
  { title: 'Confirm your household', note: 'Takes about 3 minutes', state: 'done' },
  { title: 'Apply for CalFresh', note: 'Pre-filled from your profile', state: 'done' },
  { title: 'Pick a pantry for Thursday', note: 'Westside Market, 4–6pm', state: 'now' },
  { title: 'Add school meal enrollment', note: 'For 2 children', state: 'next' },
  { title: 'Set a monthly check-in', note: 'We will remind you', state: 'next' },
];

export default function Dashboard({ onBack }) {
  return (
    <section className="dashboard">
      <header className="dash-head">
        <div>
          <p className="section-label">YOUR DASHBOARD</p>
          <h2>Welcome back. Here's <em>this week.</em></h2>
        </div>
        <button type="button" className="button small ghost" onClick={onBack}>
          ← Back to home
        </button>
      </header>

      <div className="stat-row">
        {stats.map((s, i) => (
          <article key={s.label} className="stat-card" style={{ '--pop-delay': `${0.1 + i * 0.09}s` }}>
            <p className="stat-value">{s.value}</p>
            <p className="stat-label">{s.label}</p>
            <p className="stat-note">{s.note}</p>
          </article>
        ))}
      </div>

      <div className="dash-grid">
        <article className="panel">
          <h3>Your food plan</h3>
          <ol className="plan-list">
            {plan.map((step, i) => (
              <li key={step.title} className={`plan-step is-${step.state}`} style={{ '--pop-delay': `${0.26 + i * 0.07}s` }}>
                <span className="step-dot" aria-hidden="true" />
                <div>
                  <p className="step-title">{step.title}</p>
                  <p className="step-note">{step.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel panel-accent">
          <h3>Next up</h3>
          <p className="next-big">Westside Market pantry</p>
          <p className="next-note">Thursday, 4–6pm · 1.2 miles · No ID required</p>
          <ul className="next-meta">
            <li>Fresh produce</li>
            <li>Bus line 24</li>
            <li>Spanish spoken</li>
          </ul>
          <button type="button" className="button">Add to my week</button>
        </article>
      </div>
    </section>
  );
}
