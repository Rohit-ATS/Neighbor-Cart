import React, { useCallback, useEffect, useState } from 'react';
import { createReservation, getLocationAvailability } from '../lib/api.js';

export default function ReservationModal({ place, onClose, onReservationConfirmed }) {
  const [step, setStep] = useState('form'); // 'form' | 'confirmed'
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  
  const defaultSlots = place.reservationWindows && place.reservationWindows.length > 0 
    ? place.reservationWindows 
    : ['9:30 AM – 11:00 AM', '11:30 AM – 1:00 PM', '1:30 PM – 3:00 PM', '3:00 PM – 4:15 PM'];

  const [timeSlot, setTimeSlot] = useState(defaultSlots[0]);
  const [householdSize, setHouseholdSize] = useState('2-3 people');
  const [dietary, setDietary] = useState([]);
  const [needsCurbside, setNeedsCurbside] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [confirmedPass, setConfirmedPass] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);

  const refreshAvailability = useCallback(async () => {
    setIsLoadingAvailability(true);
    setAvailabilityError('');
    try {
      const nextAvailability = await getLocationAvailability(place.id, date);
      setAvailability(nextAvailability);
      const nextOpenSlot = nextAvailability.slots.find((slot) => slot.isAvailable);
      setTimeSlot((currentSlot) => (
        nextAvailability.slots.some((slot) => slot.timeSlot === currentSlot && slot.isAvailable)
          ? currentSlot
          : (nextOpenSlot?.timeSlot ?? '')
      ));
    } catch (error) {
      setAvailability(null);
      setAvailabilityError(error.message);
      setTimeSlot('');
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [date, place.id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoadingAvailability(true);
      setAvailabilityError('');
      try {
        const nextAvailability = await getLocationAvailability(place.id, date);
        if (!active) return;
        setAvailability(nextAvailability);
        const nextOpenSlot = nextAvailability.slots.find((slot) => slot.isAvailable);
        setTimeSlot((currentSlot) => (
          nextAvailability.slots.some((slot) => slot.timeSlot === currentSlot && slot.isAvailable)
            ? currentSlot
            : (nextOpenSlot?.timeSlot ?? '')
        ));
      } catch (error) {
        if (!active) return;
        setAvailability(null);
        setAvailabilityError(error.message);
        setTimeSlot('');
      } finally {
        if (active) setIsLoadingAvailability(false);
      }
    };
    load();
    return () => { active = false; };
  }, [date, place.id]);

  const slotOptions = availability?.slots ?? defaultSlots.map((timeSlot) => ({
    timeSlot,
    available: 0,
    isAvailable: false,
  }));
  const selectedSlot = slotOptions.find((slot) => slot.timeSlot === timeSlot);

  const toggleDiet = (item) => {
    setDietary((prev) => 
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!availability || !selectedSlot?.isAvailable) {
      setSubmitError('Choose a pickup window with availability before confirming.');
      return;
    }
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const pass = await createReservation({
        locationId: place.id,
        pickupDate: date,
        timeSlot,
        householdSize,
        dietary,
        needsCurbside,
        guestName: name,
        contact,
      });
      setConfirmedPass(pass);
      setStep('confirmed');
      onReservationConfirmed?.(pass);
    } catch (error) {
      setSubmitError(error.message);
      refreshAvailability();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">×</button>

        {step === 'form' ? (
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-eyebrow">Dignity-first reservation</span>
              <h2 className="modal-title">Reserve a Food Box or Pickup</h2>
              <p className="modal-place-name">📍 {place.name}</p>
              <div className="privacy-pill">
                🔒 <b>Privacy guaranteed:</b> No ID, proof of income, or papers are ever required.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="reservation-form">
              <div className="form-group">
                <label className="form-label">Pickup Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSubmitError('');
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Select Time Window</label>
                <div className="slot-grid">
                  {slotOptions.map((slot) => (
                    <button
                      key={slot.timeSlot}
                      type="button"
                      className={`slot-pill ${timeSlot === slot.timeSlot ? 'is-selected' : ''}`}
                      onClick={() => setTimeSlot(slot.timeSlot)}
                      disabled={isLoadingAvailability || !slot.isAvailable}
                      aria-pressed={timeSlot === slot.timeSlot}
                    >
                      <span>{slot.timeSlot}</span>
                      {!isLoadingAvailability && <small>{slot.available} left</small>}
                    </button>
                  ))}
                </div>
                {isLoadingAvailability && <p className="availability-note" aria-live="polite">Checking pickup availability…</p>}
                {availabilityError && <p className="form-error" role="alert">{availabilityError}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Household Size (For appropriate portioning)</label>
                <div className="pill-row">
                  {['1 person', '2-3 people', '4-5 people', '6+ people'].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`size-pill ${householdSize === size ? 'is-selected' : ''}`}
                      onClick={() => setHouseholdSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dietary Accommodations & Preferences</label>
                <div className="diet-grid">
                  {[
                    'Vegetarian',
                    'Halal',
                    'Gluten-Free',
                    'Diabetic-Friendly',
                    'Dairy-Free',
                    'Pull-Tab / No Cooking Equipment Needed',
                    'Baby Formula / Diapers Needed'
                  ].map((diet) => (
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

              <div className="form-group">
                <label className="checkbox-card curbside-opt">
                  <input
                    type="checkbox"
                    checked={needsCurbside}
                    onChange={(e) => setNeedsCurbside(e.target.checked)}
                  />
                  <span>Curbside trunk loading requested (for mobility or disability support)</span>
                </label>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Your Name / Nickname <small>(Optional)</small></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone or Email for reminder <small>(Optional)</small></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 515-555-0199"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting || isLoadingAvailability || !selectedSlot?.isAvailable}>
                  {isSubmitting ? 'Creating your pass…' : isLoadingAvailability ? 'Checking availability…' : 'Confirm Free Reservation'}
                </button>
              </div>
              {submitError && <p className="form-error" role="alert">{submitError}</p>}
            </form>
          </div>
        ) : (
          <div className="modal-content confirmation-view">
            <div className="conf-icon">✓</div>
            <span className="modal-eyebrow">Reservation Confirmed</span>
            <h2 className="modal-title">You're All Set!</h2>
            <p className="conf-sub">We've saved your pickup reservation. Show this pass or give your confirmation code upon arrival.</p>

            <div className="pass-card">
              <div className="pass-top">
                <div>
                  <span className="pass-badge">Neighbor Cart Pass</span>
                  <h3 className="pass-place">{confirmedPass.placeName}</h3>
                  <p className="pass-addr">{confirmedPass.address}</p>
                </div>
                <div className="pass-code-box">
                  <span className="pass-code-label">CODE</span>
                  <span className="pass-code-num">{confirmedPass.code}</span>
                </div>
              </div>

              <div className="pass-details-grid">
                <div>
                  <span className="pd-label">Date</span>
                  <span className="pd-val">{confirmedPass.date}</span>
                </div>
                <div>
                  <span className="pd-label">Time Window</span>
                  <span className="pd-val">{confirmedPass.timeSlot}</span>
                </div>
                <div>
                  <span className="pd-label">Household</span>
                  <span className="pd-val">{confirmedPass.householdSize}</span>
                </div>
                <div>
                  <span className="pd-label">Guest</span>
                  <span className="pd-val">{confirmedPass.name}</span>
                </div>
              </div>

              {confirmedPass.dietary.length > 0 && (
                <div className="pass-dietary">
                  <b>Dietary Notes:</b> {confirmedPass.dietary.join(', ')}
                </div>
              )}

              {confirmedPass.needsCurbside && (
                <div className="pass-curbside-tag">🚗 Curbside loading requested</div>
              )}

              <div className="barcode-mock">
                <div className="barcode-lines" />
                <span className="barcode-sub">{confirmedPass.code} · FREE FOOD ACCESS</span>
              </div>
            </div>

            <div className="conf-tips">
              <p>💡 <b>Helpful tips:</b> Bring reusable tote bags or a cart if you have them. Walk-in or drive-up directly to the pantry entrance.</p>
            </div>

            <div className="modal-actions">
              <a
                href={place.directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                🗺 Get Driving Directions
              </a>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                🖨 Print / Save Pass
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={onClose}
              >
                Back to Places
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
