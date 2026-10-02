import React, { useState } from 'react';
import { PLACES } from '../data/places.js';

export default function ResidentIntakeModal({ onClose, onSelectPlace, lang = 'en' }) {
  const [step, setStep] = useState('questions'); // 'questions' | 'plan' | 'referral'
  const [zip, setZip] = useState('50309');
  const [householdSize, setHouseholdSize] = useState('2-3 people');
  const [urgency, setUrgency] = useState('today'); // 'today' | 'this-week' | 'ongoing'
  const [transit, setTransit] = useState('car'); // 'car' | 'transit' | 'walk' | 'delivery'
  const [dietary, setDietary] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [contactInfo, setContactInfo] = useState('');
  const [planResult, setPlanResult] = useState(null);

  const t = {
    en: {
      title: 'Personalized Food Access Navigator',
      sub: 'Answer 4 quick questions to receive a custom food assistance plan matched to your schedule, diet, and transit.',
      privacy: '🔒 100% confidential. No ID or paperwork required.',
      q1: 'ZIP Code or City',
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

  const handleGenerate = (e) => {
    e.preventDefault();

    // Match locations
    const immediate = PLACES.find((p) => p.type === 'hot-meal' || p.type === 'community-fridge') || PLACES[0];
    const pantryMatch = PLACES.find((p) => p.type === 'pantry' && (dietary.length === 0 || p.dietary?.some((d) => dietary.includes(d)))) || PLACES[1];
    const bulkMatch = PLACES.find((p) => p.type === 'food-bank' || p.type === 'mobile') || PLACES[2];

    const generated = {
      id: 'plan-' + Date.now(),
      createdAt: new Date().toLocaleDateString(),
      zip,
      householdSize,
      urgency,
      transit,
      dietary,
      immediatePlace: immediate,
      pantryPlace: pantryMatch,
      bulkPlace: bulkMatch
    };

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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="intake-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close intake">×</button>

        {step === 'questions' && (
          <div className="intake-form-wrapper">
            <span className="modal-eyebrow">Resident Support</span>
            <h2 className="modal-title">{text.title}</h2>
            <p className="intake-sub">{text.sub}</p>
            <div className="privacy-pill">{text.privacy}</div>

            <form onSubmit={handleGenerate} className="intake-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{text.q1}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="e.g. 50309 or Des Moines"
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
                <label className="form-label">{text.q3}</label>
                <div className="slot-grid">
                  <button
                    type="button"
                    className={`slot-pill ${urgency === 'today' ? 'is-selected' : ''}`}
                    onClick={() => setUrgency('today')}
                  >
                    ⚡ {text.today}
                  </button>
                  <button
                    type="button"
                    className={`slot-pill ${urgency === 'this-week' ? 'is-selected' : ''}`}
                    onClick={() => setUrgency('this-week')}
                  >
                    📅 {text.week}
                  </button>
                  <button
                    type="button"
                    className={`slot-pill ${urgency === 'ongoing' ? 'is-selected' : ''}`}
                    onClick={() => setUrgency('ongoing')}
                  >
                    🔄 {text.ongoing}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{text.q4}</label>
                <div className="slot-grid">
                  <button
                    type="button"
                    className={`slot-pill ${transit === 'car' ? 'is-selected' : ''}`}
                    onClick={() => setTransit('car')}
                  >
                    🚗 {text.car}
                  </button>
                  <button
                    type="button"
                    className={`slot-pill ${transit === 'transit' ? 'is-selected' : ''}`}
                    onClick={() => setTransit('transit')}
                  >
                    🚌 {text.transitOpt}
                  </button>
                  <button
                    type="button"
                    className={`slot-pill ${transit === 'walk' ? 'is-selected' : ''}`}
                    onClick={() => setTransit('walk')}
                  >
                    🚶 {text.walkOpt}
                  </button>
                  <button
                    type="button"
                    className={`slot-pill ${transit === 'delivery' ? 'is-selected' : ''}`}
                    onClick={() => setTransit('delivery')}
                  >
                    📦 {text.deliveryOpt}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{text.dietLabel}</label>
                <div className="diet-grid">
                  {['Vegetarian', 'Halal', 'Kosher', 'Gluten-Free', 'Diabetic-Friendly', 'Baby Formula / Infant Food', 'No-Cook / Pull-Tab Cans'].map((diet) => (
                    <label key={diet} className="checkbox-card">
                      <input
                        type="checkbox"
                        checked={dietary.includes(diet)}
                        onChange={() => toggleDiet(diet)}
                      />
                      <span>{diet}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  {text.btnGenerate}
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
                      onClose();
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
                      onClose();
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
                      onClose();
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
                onClose();
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
      </div>
    </div>
  );
}
