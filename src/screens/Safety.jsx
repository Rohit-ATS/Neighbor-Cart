import React from 'react';
import { Link } from '../app/router.jsx';
import { Button, Icon, SafetyNote } from '../components/ui.jsx';

const SECTIONS = [
  {
    title: 'What our labels mean',
    body: 'Every allergen badge reports what a provider has published, not a judgement about your safety. "Published ingredients" means they list them. "Cross-contact risk" means they have told us about a shared surface, fryer or station. "Not published" means we have nothing, and we will never fill that gap with a guess.',
  },
  {
    title: 'Questions worth asking',
    body: 'Is shared fryer oil used? Can this be made without dairy? Are peanuts handled anywhere in the kitchen? Can you change gloves and use a clean pan? Staff answer these every day, and asking is normal.',
  },
  {
    title: 'What Neighbor Cart is not',
    body: 'We are a food information tool. We do not give medical or nutritional advice, we do not diagnose, and we cannot guarantee that a dish is safe for you. If you have a serious allergy, your provider and your clinician are the authorities, not this app.',
  },
  {
    title: 'Your data',
    body: 'Your profile stays on your device in this demo. You control what you share, and clearing it removes every preference we hold.',
  },
];

export default function Safety() {
  return (
    <main className="safety-page" id="main">
      <div className="shell narrow">
        <header className="page-head">
          <p className="mono">Safety &amp; privacy</p>
          <h1>How we handle <em className="serif">allergen information.</em></h1>
        </header>
        <SafetyNote>
          Neighbor Cart provides food information, not medical advice. Always verify allergens and
          ingredients directly with the restaurant or manufacturer.
        </SafetyNote>
        <ul className="safety-list">
          {SECTIONS.map((s) => (
            <li key={s.title}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </li>
          ))}
        </ul>
        <div className="safety-actions">
          <Button as={Link} to="/profile" variant="primary" size="md">Review your profile</Button>
          <Link to="/app" className="text-link">Back to dashboard <Icon name="arrow" size={15} /></Link>
        </div>
      </div>
    </main>
  );
}
