import React, { useState } from 'react';
import { PLACES } from '../data/places.js';
import { saveResidentProfile } from '../lib/residentProfile.js';

/* The navigator renders either as a workspace page (`variant="page"`) or as the
   modal it has always been. On a page there is nothing to dismiss, so the close
   button is dropped and the steps that used to close the modal on their way out
   — opening a place, submitting a referral — simply leave the page standing. */
export default function ResidentIntakeModal({ onClose, onSelectPlace, lang = 'en', variant = 'modal' }) {
  const isPage = variant === 'page';
  const dismiss = () => { if (!isPage) onClose?.(); };
  const [step, setStep] = useState('questions'); // 'questions' | 'plan' | 'referral'
  const [zip, setZip] = useState('50309');
  const [address, setAddress] = useState('');
  const [householdSize, setHouseholdSize] = useState('2-3 people');
  const [urgency, setUrgency] = useState('today'); // 'today' | 'this-week' | 'ongoing'
  const [transit, setTransit] = useState('car'); // 'car' | 'transit' | 'walk' | 'delivery'
  const [dietary, setDietary] = useState([]);
  const [otherNeed, setOtherNeed] = useState('');
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
      q1: 'ZIP Code or City',
      address: 'Street address or neighborhood (optional)',
      q2: 'Household Size',
      q3: 'When do you need food?',
      today: 'Immediately today (Within 24 hours)',
      week: 'This upcoming weekend / week',
      ongoing: 'Ongoing monthly assistance',
      q4: 'Transportation Method',
      car: 'Personal Car / Drive-thru',
      transitOpt: 'Public Transit (Bus / Train)',
      walkOpt: 'Walking / Nearby only',
      deliveryOpt: 'Homebound / Need Delivery',
      dietLabel: 'Dietary Needs & Accommodations',
      btnGenerate: 'Generate My Free Food Plan →',
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
      q1: 'Código Postal o Ciudad',
      address: 'Dirección o vecindario (opcional)',
      q2: 'Tamaño del Hogar',
      q3: '¿Cuándo necesita alimentos?',
      today: 'Inmediatamente hoy (En 24 horas)',
      week: 'Este fin de semana / semana',
      ongoing: 'Ayuda mensual continua',
      q4: 'Método de Transporte',
      car: 'Auto Propio / Drive-thru',
      transitOpt: 'Transporte Público (Autobús / Metro)',
      walkOpt: 'Caminando / Solo cerca',
      deliveryOpt: 'No puedo salir / Necesito Entrega',
      dietLabel: 'Necesidades Dietéticas y Preferencias',
      btnGenerate: 'Generar Mi Plan de Comida Gratuito →',
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
            <h2 className="lmh-title">{step === 'questions' ? text.title : step === 'plan' ? text.planTitle : 'Confidential Partner Referral'}</h2>
            <p className="lmh-sub">
              {step === 'questions' ? text.sub : step === 'plan' ? `Customized for ${planResult?.householdSize} in ZIP ${planResult?.zip}.` : 'Zero paperwork required. 100% confidential assistance.'}
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
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{text.q1}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="e.g. 50309, Des Moines, NYC..."
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{text.q2}</label>
                    <select
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
                  <label className="form-label">{text.address}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 123 Main St or Northside neighborhood"
                    autoComplete="street-address"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{text.q3}</label>
                  <div className="intake-choice-grid">
                    <button
                      type="button"
                      className={`intake-choice-card ${urgency === 'today' ? 'is-selected' : ''}`}
                      onClick={() => setUrgency('today')}
                    >
                      <span className="icc-icon">⚡</span>
                      <div className="icc-info">
                        <strong>{text.today}</strong>
                        <span>Walk-in hot meals, fridges & crisis boxes</span>
                      </div>
                      <span className="icc-check" />
                    </button>

                    <button
                      type="button"
                      className={`intake-choice-card ${urgency === 'this-week' ? 'is-selected' : ''}`}
                      onClick={() => setUrgency('this-week')}
                    >
                      <span className="icc-icon">📅</span>
                      <div className="icc-info">
                        <strong>{text.week}</strong>
                        <span>Pantry appointments & weekend distributions</span>
                      </div>
                      <span className="icc-check" />
                    </button>

                    <button
                      type="button"
                      className={`intake-choice-card full-width ${urgency === 'ongoing' ? 'is-selected' : ''}`}
                      onClick={() => setUrgency('ongoing')}
                    >
                      <span className="icc-icon">🔄</span>
                      <div className="icc-info">
                        <strong>{text.ongoing}</strong>
                        <span>Monthly food bank allotments, SNAP enrollment, & grocery delivery</span>
                      </div>
                      <span className="icc-check" />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{text.q4}</label>
                  <div className="intake-choice-grid">
                    <button
                      type="button"
                      className={`intake-choice-card ${transit === 'car' ? 'is-selected' : ''}`}
                      onClick={() => setTransit('car')}
                    >
                      <span className="icc-icon">🚗</span>
                      <div className="icc-info">
                        <strong>{text.car}</strong>
                        <span>Drive-thru trunk loading eligible</span>
                      </div>
                      <span className="icc-check" />
                    </button>

                    <button
                      type="button"
                      className={`intake-choice-card ${transit === 'transit' ? 'is-selected' : ''}`}
                      onClick={() => setTransit('transit')}
                    >
                      <span className="icc-icon">🚌</span>
                      <div className="icc-info">
                        <strong>{text.transitOpt}</strong>
                        <span>Near public bus or transit lines</span>
                      </div>
                      <span className="icc-check" />
                    </button>

                    <button
                      type="button"
                      className={`intake-choice-card ${transit === 'walk' ? 'is-selected' : ''}`}
                      onClick={() => setTransit('walk')}
                    >
                      <span className="icc-icon">🚶</span>
                      <div className="icc-info">
                        <strong>{text.walkOpt}</strong>
                        <span>Under 1-mile walking distance</span>
                      </div>
                      <span className="icc-check" />
                    </button>

                    <button
                      type="button"
                      className={`intake-choice-card ${transit === 'delivery' ? 'is-selected' : ''}`}
                      onClick={() => setTransit('delivery')}
                    >
                      <span className="icc-icon">📦</span>
                      <div className="icc-info">
                        <strong>{text.deliveryOpt}</strong>
                        <span>Homebound door delivery options</span>
                      </div>
                      <span className="icc-check" />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{text.dietLabel}</label>
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

                <div className="modal-actions-bar">
                  <button type="submit" className="lexis-submit-btn">
                    <span>{text.btnGenerate}</span>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
