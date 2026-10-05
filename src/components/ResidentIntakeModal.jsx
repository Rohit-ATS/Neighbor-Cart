import React, { useState } from 'react';
import { PLACES } from '../data/places.js';
import { getResidentProfile, saveResidentProfile } from '../lib/residentProfile.js';

/* Line icons rather than emoji. An emoji is a different typeface rendered by
   the operating system — it sets its own colour, its own weight and its own
   idea of a car, which is why the row of them read as clip art pasted into a
   form. These are drawn in the same stroke as the rest of the product and take
   the colour of the card they sit in, including when it is selected. */
const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/* The answers, as data: the markup for a choice card is the same four times
   over, and keeping it in one place is what lets the two questions stay
   visually identical. `labelKey` reads from the translated copy below, so
   these carry no English of their own except the hint. */
const URGENCY_OPTIONS = [
  {
    id: 'today', labelKey: 'today', hint: 'Walk-in hot meals, fridges & crisis boxes',
    icon: <Icon><polygon points="13 2 3 14 11 14 10 22 21 10 13 10 13 2" /></Icon>,
  },
  {
    id: 'this-week', labelKey: 'week', hint: 'Pantry appointments & weekend distributions',
    icon: <Icon><rect x="3" y="4.5" width="18" height="17" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></Icon>,
  },
  {
    id: 'ongoing', labelKey: 'ongoing', hint: 'Monthly allotments, SNAP enrollment & delivery',
    icon: <Icon><path d="M20.5 11.5a8.5 8.5 0 0 0-14.6-5.4L3 9M3.5 12.5a8.5 8.5 0 0 0 14.6 5.4L21 15" /><path d="M3 4.5v4.6h4.6M21 19.5v-4.6h-4.6" /></Icon>,
  },
];

const TRANSIT_OPTIONS = [
  {
    id: 'car', labelKey: 'car', hint: 'Drive-thru trunk loading eligible',
    icon: <Icon><path d="M5 17h14M4.5 17v-4.2l2-5.3A1.8 1.8 0 0 1 8.2 6.3h7.6a1.8 1.8 0 0 1 1.7 1.2l2 5.3V17" /><path d="M4.5 12.8h15" /><circle cx="7.8" cy="17" r="1.6" /><circle cx="16.2" cy="17" r="1.6" /></Icon>,
  },
  {
    id: 'transit', labelKey: 'transitOpt', hint: 'Near a bus route or rail station',
    icon: <Icon><rect x="4.5" y="3.5" width="15" height="13" rx="2.5" /><path d="M4.5 10.5h15M7.5 20l1.8-3.5M16.5 20l-1.8-3.5" /><circle cx="8.3" cy="13.6" r="1" /><circle cx="15.7" cy="13.6" r="1" /></Icon>,
  },
  {
    id: 'walk', labelKey: 'walkOpt', hint: 'Within about a mile of you',
    icon: <Icon><circle cx="13" cy="4.2" r="1.8" /><path d="M11.4 21l1.3-5.6-2.4-2.1.9-4.6 3.3 1.5 2.1 2.4M10 10.3 7.2 12l-.9 3.2M12.7 15.4 15 21" /></Icon>,
  },
  {
    id: 'delivery', labelKey: 'deliveryOpt', hint: 'Brought to your door at home',
    icon: <Icon><path d="M12 3.2 20.5 7.6v8.8L12 20.8 3.5 16.4V7.6Z" /><path d="M3.5 7.6 12 12m0 0 8.5-4.4M12 12v8.8" /></Icon>,
  },
];

/* The navigator renders either as a workspace page (`variant="page"`) or as the
   modal it has always been. On a page there is nothing to dismiss, so the close
   button is dropped and the steps that used to close the modal on their way out
   — opening a place, submitting a referral — simply leave the page standing. */
export default function ResidentIntakeModal({ onClose, onSelectPlace, lang = 'en', variant = 'modal', profileMode = false }) {
  const isPage = variant === 'page';
  const dismiss = () => { if (!isPage) onClose?.(); };
  const [step, setStep] = useState('questions'); // 'questions' | 'plan' | 'referral'
  const [zip, setZip] = useState(() => getResidentProfile()?.location || '94110');
  const [address, setAddress] = useState(() => getResidentProfile()?.address || '');
  const [householdSize, setHouseholdSize] = useState(() => getResidentProfile()?.householdSize || '2-3 people');
  const [urgency, setUrgency] = useState(() => getResidentProfile()?.urgency || 'today'); // 'today' | 'this-week' | 'ongoing'
  const [transit, setTransit] = useState(() => getResidentProfile()?.transportation || 'car'); // 'car' | 'transit' | 'walk' | 'delivery'
  const [dietary, setDietary] = useState(() => getResidentProfile()?.dietary || []);
  const [otherNeed, setOtherNeed] = useState(() => getResidentProfile()?.otherNeed || '');
  const [otherNeedDraft, setOtherNeedDraft] = useState('');
  const [showOtherComposer, setShowOtherComposer] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [contactInfo, setContactInfo] = useState('');
  const [planResult, setPlanResult] = useState(null);

  const t = {
    en: {
      title: 'Personalized Food Access Navigator',
      sub: 'Answer 4 quick questions to receive a custom food assistance plan matched to your schedule, diet, and transit.',
      privacy: '🔒 100% confidential. No ID or paperwork required.',
      q1: 'ZIP code or city',
      address: 'Street address or neighborhood',
      optional: 'optional',
      q2: 'Household size',
      s1Title: 'Where you are, and who you’re feeding',
      s1Hint: 'A ZIP code is enough. An address only helps us judge walking distance.',
      s2Hint: 'This decides whether we look for a hot meal tonight or a monthly box.',
      s3Hint: 'We only suggest places you can actually reach this way.',
      s4Hint: 'Pick any that apply, or skip this — it narrows the shelves we check.',
      q3: 'When do you need food?',
      today: 'Today, within 24 hours',
      week: 'This week or weekend',
      ongoing: 'Every month, ongoing',
      q4: 'How will you get there?',
      car: 'By car',
      transitOpt: 'Public transit',
      walkOpt: 'On foot',
      deliveryOpt: 'I need delivery',
      dietLabel: 'Any dietary needs?',
      btnGenerate: 'Generate my free food plan',
      planTitle: 'Your Personalized Food Access Plan',
      step1: 'Step 1: Immediate Food for Today',
      step2: 'Step 2: Full Family Grocery Pantry',
      step3: 'Step 3: Supplemental Nutrition & Produce',
      btnSave: '💾 Save Plan to Device',
      btnPrint: '🖨 Print Plan',
      btnReferral: '📞 Request Confidential Callback'
    },
    es: {
      title: 'Navegador Personalizado de Acceso a Alimentos',
      sub: 'Responda 4 preguntas para recibir un plan de alimentos adaptado a su horario, dieta y transporte.',
      privacy: '🔒 100% confidencial. No se requiere identificación ni documentos.',
      q1: 'Código postal o ciudad',
      address: 'Dirección o vecindario',
      optional: 'opcional',
      q2: 'Tamaño del hogar',
      s1Title: 'Dónde está y a cuántas personas alimenta',
      s1Hint: 'Con el código postal basta. La dirección solo ayuda a calcular la distancia a pie.',
      s2Hint: 'Esto decide si buscamos una comida caliente hoy o una caja mensual.',
      s3Hint: 'Solo sugerimos lugares a los que realmente puede llegar así.',
      s4Hint: 'Elija lo que corresponda, u omita este paso.',
      q3: '¿Cuándo necesita alimentos?',
      today: 'Hoy, en 24 horas',
      week: 'Esta semana o fin de semana',
      ongoing: 'Cada mes, de forma continua',
      q4: '¿Cómo llegará?',
      car: 'En auto',
      transitOpt: 'Transporte público',
      walkOpt: 'A pie',
      deliveryOpt: 'Necesito entrega',
      dietLabel: '¿Alguna necesidad alimentaria?',
      btnGenerate: 'Generar mi plan de comida gratuito',
      planTitle: 'Su Plan Personalizado de Alimentos',
      step1: 'Paso 1: Alimentos Inmediatos para Hoy',
      step2: 'Paso 2: Despensa Familiar Completa',
      step3: 'Paso 3: Nutrición Suplementaria y Verduras',
      btnSave: '💾 Guardar Plan en Dispositivo',
      btnPrint: '🖨 Imprimir Plan',
      btnReferral: '📞 Solicitar Llamada Confidencial'
    }
  };

  const text = t[lang] || t.en;

  const toggleDiet = (item) => {
    setDietary((prev) => 
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  const openOtherComposer = () => {
    if (dietary.includes('Other')) {
      setDietary((prev) => prev.filter((item) => item !== 'Other'));
      setOtherNeed('');
      return;
    }
    setDietary((prev) => [...prev, 'Other']);
    setOtherNeedDraft(otherNeed);
    setShowOtherComposer(true);
  };

  const saveOtherNeed = () => {
    const requirement = otherNeedDraft.trim().slice(0, 500);
    if (!requirement) return;
    setOtherNeed(requirement);
    setShowOtherComposer(false);
    // The AI navigator reads this private browser-session context whenever a
    // resident asks it to suggest places later.
    try {
      const previous = JSON.parse(sessionStorage.getItem('harvestlink-ai-needs') || '[]');
      const memory = Array.isArray(previous) ? previous : [];
      const remembered = `Other food requirement: ${requirement}`;
      sessionStorage.setItem('harvestlink-ai-needs', JSON.stringify([...memory, remembered].filter((item, index, list) => list.indexOf(item) === index).slice(-12)));
    } catch {
      // The intake plan still keeps the requirement if browser storage is unavailable.
    }
  };

  const closeOtherComposer = () => {
    setShowOtherComposer(false);
    if (!otherNeed) setDietary((prev) => prev.filter((item) => item !== 'Other'));
  };

  const handleGenerate = (e) => {
    e.preventDefault();

    // Match locations
    const immediate = PLACES.find((p) => p.type === 'hot-meal' || p.type === 'community-fridge') || PLACES[0];
    const matchedDietary = dietary.filter((item) => item !== 'Other');
    const pantryMatch = PLACES.find((p) => p.type === 'pantry' && (matchedDietary.length === 0 || p.dietary?.some((d) => matchedDietary.includes(d)))) || PLACES[1];
    const bulkMatch = PLACES.find((p) => p.type === 'food-bank' || p.type === 'mobile') || PLACES[2];

    const generated = {
      id: 'plan-' + Date.now(),
      createdAt: new Date().toLocaleDateString(),
      zip,
      householdSize,
      urgency,
      transit,
      dietary: otherNeed ? [...matchedDietary, `Other: ${otherNeed}`] : matchedDietary,
      immediatePlace: immediate,
      pantryPlace: pantryMatch,
      bulkPlace: bulkMatch
    };

    // Keep this profile only for the current browser session. The AI reads it
    // automatically for later questions, so residents do not need to repeat
    // their location, household, transport, or food requirements.
    saveResidentProfile({
      location: zip,
      address,
      householdSize,
      urgency: urgency === 'today' ? 'Needs food today' : urgency === 'this-week' ? 'Needs food this week' : 'Ongoing monthly food support',
      transportation: transit === 'car' ? 'Personal car / drive-thru' : transit === 'transit' ? 'Public transit' : transit === 'walk' ? 'Walking / nearby only' : 'Home delivery needed',
      dietary: generated.dietary,
      otherNeed,
    });

    setPlanResult(generated);
    setStep('plan');

    // Save to localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('nc_saved_plans') || '[]');
      localStorage.setItem('nc_saved_plans', JSON.stringify([generated, ...existing]));
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`modal-backdrop${isPage ? ' is-page' : ''}`}
      onClick={isPage ? undefined : onClose}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      data-ai-section={isPage ? 'intake' : undefined}
    >
      <div className="intake-modal-card lexis-modal" onClick={isPage ? undefined : (e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="lexis-modal-header">
          <div className="lmh-copy">
            <span className="lmh-eyebrow">
              <span className="lmh-dot" /> Resident Support Navigator
            </span>
            <h2 className="lmh-title">{step === 'questions' ? (profileMode ? 'Personal Information' : text.title) : step === 'plan' ? text.planTitle : 'Confidential Partner Referral'}</h2>
            <p className="lmh-sub">
              {step === 'questions' ? (profileMode ? 'Review and update the information saved only in this browser to personalize your food plan.' : text.sub) : step === 'plan' ? `Customized for ${planResult?.householdSize} in ZIP ${planResult?.zip}.` : 'Zero paperwork required. 100% confidential assistance.'}
            </p>
          </div>

          {!isPage && (
            <button 
              type="button" 
              className="lexis-modal-close" 
              onClick={onClose} 
              aria-label="Close navigator"
              title="Close"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="intake-modal-scroll">
          {step === 'questions' && (
            <div className="intake-form-wrapper">
              <div className="lexis-privacy-callout">
                <span className="lpc-icon">🛡️</span>
                <div className="lpc-text">
                  <strong>No ID or paperwork required:</strong> Your intake plan stays on this device. If you later choose AI personalization or Google travel times, we will ask before sharing details with those services.
                </div>
              </div>

              <form onSubmit={handleGenerate} className="intake-form">
                {/* Four numbered steps, in the order the plan is built from
                    them. The promise at the top of the page is four questions,
                    so the page has to show four — a flat column of five fields
                    is the same work without the shape that makes it feel short.
                    Each step says what it is for, because "Transportation
                    method" only sounds obvious once you know it decides which
                    places can be reached. */}
                <ol className="intake-steps">
                  <li className="intake-step">
                    <div className="istep-head">
                      <span className="istep-num">1</span>
                      <div className="istep-copy">
                        <h3>{text.s1Title}</h3>
                        <p>{text.s1Hint}</p>
                      </div>
                    </div>
                    <div className="istep-body">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="intake-zip">{text.q1}</label>
                          <input
                            id="intake-zip"
                            type="text"
                            className="form-input"
                            value={zip}
                            onChange={(e) => setZip(e.target.value)}
                            placeholder="e.g. 94110, San Francisco, Fremont…"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="intake-household">{text.q2}</label>
                          <select
                            id="intake-household"
                            className="form-input"
                            value={householdSize}
                            onChange={(e) => setHouseholdSize(e.target.value)}
                          >
                            <option value="1 person">1 person</option>
                            <option value="2-3 people">2-3 people</option>
                            <option value="4-5 people">4-5 people</option>
                            <option value="6+ people">6+ people</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="intake-address">
                          {text.address} <small>{text.optional}</small>
                        </label>
                        <input
                          id="intake-address"
                          type="text"
                          className="form-input"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. 123 Main St or Mission District"
                          autoComplete="street-address"
                        />
                      </div>
                    </div>
                  </li>

                  <li className="intake-step">
                    <div className="istep-head">
                      <span className="istep-num">2</span>
                      <div className="istep-copy">
                        <h3>{text.q3}</h3>
                        <p>{text.s2Hint}</p>
                      </div>
                    </div>
                    <div className="istep-body">
                      <div className="intake-choice-grid" role="radiogroup" aria-label={text.q3}>
                        {URGENCY_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={urgency === option.id}
                            className={`intake-choice-card ${urgency === option.id ? 'is-selected' : ''}`}
                            onClick={() => setUrgency(option.id)}
                          >
                            <span className="icc-icon">{option.icon}</span>
                            <span className="icc-info">
                              <strong>{text[option.labelKey]}</strong>
                              <span>{option.hint}</span>
                            </span>
                            <span className="icc-check" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>

                  <li className="intake-step">
                    <div className="istep-head">
                      <span className="istep-num">3</span>
                      <div className="istep-copy">
                        <h3>{text.q4}</h3>
                        <p>{text.s3Hint}</p>
                      </div>
                    </div>
                    <div className="istep-body">
                      <div className="intake-choice-grid" role="radiogroup" aria-label={text.q4}>
                        {TRANSIT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={transit === option.id}
                            className={`intake-choice-card ${transit === option.id ? 'is-selected' : ''}`}
                            onClick={() => setTransit(option.id)}
                          >
                            <span className="icc-icon">{option.icon}</span>
                            <span className="icc-info">
                              <strong>{text[option.labelKey]}</strong>
                              <span>{option.hint}</span>
                            </span>
                            <span className="icc-check" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>

                  <li className="intake-step">
                    <div className="istep-head">
                      <span className="istep-num">4</span>
                      <div className="istep-copy">
                        <h3>{text.dietLabel} <small>{text.optional}</small></h3>
                        <p>{text.s4Hint}</p>
                      </div>
                    </div>
                    <div className="istep-body">
                      <div className="intake-diet-tags">
                        {['Vegetarian', 'Halal', 'Kosher', 'Gluten-Free', 'Diabetic-Friendly', 'Baby Formula / Infant Food', 'No-Cook / Pull-Tab Cans', 'Other'].map((diet) => (
                          <label key={diet} className={`intake-diet-chip ${dietary.includes(diet) ? 'is-checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={dietary.includes(diet)}
                              onChange={() => diet === 'Other' ? openOtherComposer() : toggleDiet(diet)}
                            />
                            <span className="idc-box" />
                            <span className="idc-text">{diet === 'Other' && otherNeed ? `Other: ${otherNeed}` : diet}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </li>
                </ol>

                {/* The one action on the page, and what it costs: nothing. */}
                <div className="intake-submit-bar">
                  <p className="isb-note">{text.privacy}</p>
                  <button type="submit" className="lexis-submit-btn">
                    <span>{text.btnGenerate}</span>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          )}

        {step === 'plan' && planResult && (
          <div className="intake-plan-view">
            <span className="modal-eyebrow">Action Plan Generated</span>
            <h2 className="modal-title">{text.planTitle}</h2>
            <p className="intake-sub">Customized for {planResult.householdSize} in area {planResult.zip}.</p>

            <div className="plan-steps-container">
              {/* Step 1 */}
              <div className="plan-card-item">
                <div className="pci-header">
                  <span className="pci-badge">⚡ Immediate Assistance</span>
                  <span className="pci-status">Open Today</span>
                </div>
                <h3 className="pci-title">{planResult.immediatePlace.name}</h3>
                <p className="pci-addr">📍 {planResult.immediatePlace.address}, {planResult.immediatePlace.cityStateZip}</p>
                <p className="pci-hours">⏱ {planResult.immediatePlace.hoursSummary}</p>
                <p className="pci-reason">💡 <b>Why this fits:</b> Provides walk-in immediate meals or pantry items with zero waiting period.</p>
                <div className="pci-actions">
                  <button
                    type="button"
                    className="btn-primary small"
                    onClick={() => {
                      dismiss();
                      onSelectPlace?.(planResult.immediatePlace);
                    }}
                  >
                    View Details & Directions →
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="plan-card-item">
                <div className="pci-header">
                  <span className="pci-badge">🧺 Family Grocery Market</span>
                  <span className="pci-status">Choice Market</span>
                </div>
                <h3 className="pci-title">{planResult.pantryPlace.name}</h3>
                <p className="pci-addr">📍 {planResult.pantryPlace.address}, {planResult.pantryPlace.cityStateZip}</p>
                <p className="pci-hours">⏱ {planResult.pantryPlace.hoursSummary}</p>
                <p className="pci-reason">💡 <b>Why this fits:</b> High fresh produce stock and accommodates your selected dietary needs.</p>
                <div className="pci-actions">
                  <button
                    type="button"
                    className="btn-primary small"
                    onClick={() => {
                      dismiss();
                      onSelectPlace?.(planResult.pantryPlace);
                    }}
                  >
                    View Details & Directions →
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="plan-card-item">
                <div className="pci-header">
                  <span className="pci-badge">📦 Bulk & Monthly Reserves</span>
                  <span className="pci-status">Regional Hub</span>
                </div>
                <h3 className="pci-title">{planResult.bulkPlace.name}</h3>
                <p className="pci-addr">📍 {planResult.bulkPlace.address}, {planResult.bulkPlace.cityStateZip}</p>
                <p className="pci-hours">⏱ {planResult.bulkPlace.hoursSummary}</p>
                <p className="pci-reason">💡 <b>Why this fits:</b> Large volume distribution boxes and SNAP benefits enrollment support.</p>
                <div className="pci-actions">
                  <button
                    type="button"
                    className="btn-primary small"
                    onClick={() => {
                      dismiss();
                      onSelectPlace?.(planResult.bulkPlace);
                    }}
                  >
                    View Details & Directions →
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => window.print()}>
                {text.btnPrint}
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => setStep('referral')}
              >
                {text.btnReferral}
              </button>
            </div>
          </div>
        )}

        {step === 'referral' && (
          <div className="referral-view">
            <span className="modal-eyebrow">Confidential Assistance</span>
            <h2 className="modal-title">Request a Callback or Partner Referral</h2>
            <p className="intake-sub">A compassionate community coordinator will reach out to connect you with home delivery, SNAP assistance, or special dietary boxes.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert('Thank you. A confidential community referral has been submitted. A team coordinator will contact you shortly.');
                // A modal closes on its way out; a page has nowhere to go, so it
                // returns to the plan the referral was requested from.
                if (isPage) setStep('plan'); else dismiss();
              }}
              className="intake-form"
            >
              <div className="form-group">
                <label className="form-label">Phone Number or Email</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 515-555-0144 or myemail@gmail.com"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  <span>Keep my referral confidential and protect my privacy</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep('plan')}>
                  ← Back to Plan
                </button>
                <button type="submit" className="btn-primary">
                  Submit Referral Request
                </button>
              </div>
            </form>
          </div>
        )}
        </div> {/* /.intake-modal-scroll */}
        {showOtherComposer && (
          <div className="other-need-backdrop" role="presentation" onClick={closeOtherComposer}>
            <section className="other-need-composer" role="dialog" aria-modal="true" aria-labelledby="other-need-title" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="other-need-close" onClick={closeOtherComposer} aria-label="Close">×</button>
              <p className="other-need-eyebrow">Personalize your food plan</p>
              <h3 id="other-need-title">Tell us what you need</h3>
              <p>For example: a sesame allergy, low-sodium meals, soft foods, culturally familiar groceries, or another accommodation.</p>
              <textarea
                autoFocus
                value={otherNeedDraft}
                onChange={(event) => setOtherNeedDraft(event.target.value)}
                placeholder="Describe your food need or accommodation…"
                maxLength={500}
                rows={4}
              />
              <div className="other-need-actions">
                <button type="button" className="other-need-cancel" onClick={closeOtherComposer}>Cancel</button>
                <button type="button" className="other-need-save" onClick={saveOtherNeed} disabled={!otherNeedDraft.trim()}>Save requirement</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
