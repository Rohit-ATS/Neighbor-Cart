import React, { useState } from 'react';
import { VOLUNTEER_SHIFTS } from '../data/communityData.js';
import { downloadIcs, googleCalendarUrl, shiftEvent, shiftWhen } from '../lib/calendar.js';

/* The two ways a shift gets into a calendar. Google opens a pre-filled event
   that saves in one click; everything else — Apple Calendar, Outlook, Fastmail,
   Thunderbird — opens the .ics. Neither writes anything on its own: both hand
   the event over and let the person confirm it. */
function AddToCalendar({ shift, compact = false }) {
  const event = shiftEvent(shift);
  const filename = `${shift.id}-volunteer-shift.ics`;

  return (
    <div className={`vol-calendar${compact ? ' is-compact' : ''}`}>
      {!compact && <span className="vcal-label">Add it to your calendar</span>}
      <div className="vcal-actions">
        <a
          className="vcal-btn"
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
            <path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4" />
          </svg>
          Google Calendar
        </a>
        <button type="button" className="vcal-btn" onClick={() => downloadIcs(event, filename)}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.5v11M8 11l4 4 4-4M4.5 19.5h15" />
          </svg>
          Apple / Outlook (.ics)
        </button>
      </div>
    </div>
  );
}

export default function VolunteerHub({ onClose, onSelectPlace, variant = 'modal' }) {
  const isPage = variant === 'page';
  const [shifts, setShifts] = useState(VOLUNTEER_SHIFTS);
  const [selectedTaskType, setSelectedTaskType] = useState('all');
  const [claimedShiftModal, setClaimedShiftModal] = useState(null);

  const filteredShifts = shifts.filter((s) => {
    if (selectedTaskType !== 'all' && s.taskType !== selectedTaskType) return false;
    return true;
  });

  const handleClaimShift = (shift) => {
    setShifts(
      shifts.map((s) =>
        s.id === shift.id
          ? { ...s, claimed: true, spotsAvailable: Math.max(0, s.spotsAvailable - 1) }
          : s
      )
    );
    setClaimedShiftModal(shift);
  };

  return (
    <div
      className={`modal-backdrop${isPage ? ' is-page' : ''}`}
      onClick={isPage ? undefined : onClose}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      data-ai-section={isPage ? 'volunteer' : undefined}
    >
      <div className="volunteer-modal-card" onClick={isPage ? undefined : (e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vol-header">
          <div>
            <span className="np-badge">🤝 Volunteer &amp; Relief Network</span>
            <h2 className="np-title">Community Volunteer Shifts</h2>
            <p className="np-sub">
              Support local food relief across San Francisco, Oakland, San Jose, and Fremont. 
              Claim open shifts for food sorting, mobile food distributions, and pantry grocery support.
            </p>
          </div>
          {!isPage && (
            <button className="modal-close" onClick={onClose} aria-label="Close volunteer hub">
              ×
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="vol-filter-strip">
          <span className="filter-label">Filter Role:</span>
          {['all', 'Warehouse Sorting', 'Mobile Distribution', 'Food Rescue Pickup', 'Home Delivery Route'].map((type) => (
            <button
              key={type}
              type="button"
              className={`vol-filter-pill ${selectedTaskType === type ? 'is-active' : ''}`}
              onClick={() => setSelectedTaskType(type)}
            >
              {type === 'all' ? 'All Roles' : type}
            </button>
          ))}
        </div>

        {/* Shift List */}
        <div className="vol-shifts-list">
          {filteredShifts.map((shift) => (
            <div key={shift.id} className="vol-shift-card">
              <div className="vsc-top">
                <span className="vsc-type-tag">{shift.taskType}</span>
                <span className="vsc-spots">
                  {shift.spotsAvailable > 0 ? `${shift.spotsAvailable} spots remaining` : 'Full'}
                </span>
              </div>
              <h3 className="vsc-title">{shift.title}</h3>
              <p className="vsc-org">
                🏢 <b>{shift.orgName}</b> · 📍 {shift.location}
              </p>
              <p className="vsc-date">
                ⏱ {shiftWhen(shift)} · <b>{shift.hoursGranted} hrs</b> volunteer credit
              </p>
              <p className="vsc-skills">
                💡 <b>Requirements:</b> {shift.skillsNeeded}
              </p>
              <p className="vsc-impact">
                🌟 <b>Impact:</b> {shift.impactEstimate}
              </p>

              <div className="vsc-actions">
                {shift.claimed ? (
                  <>
                    <span className="vsc-claimed-badge">✓ Registered for this shift</span>
                    <AddToCalendar shift={shift} compact />
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-primary small"
                    onClick={() => handleClaimShift(shift)}
                    disabled={shift.spotsAvailable <= 0}
                  >
                    {shift.spotsAvailable > 0 ? 'Sign Up / Claim Shift' : 'Shift Full'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredShifts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--d-muted)' }}>
              <p>No volunteer shifts match the selected role filter.</p>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '12px' }}
                onClick={() => setSelectedTaskType('all')}
              >
                Show All Volunteer Shifts
              </button>
            </div>
          )}
        </div>

        {/* Claim modal / confirmation */}
        {claimedShiftModal && (
          <div className="claim-confirm-overlay" onClick={() => setClaimedShiftModal(null)}>
            <div className="claim-confirm-box" onClick={(e) => e.stopPropagation()}>
              <span className="conf-icon">✓</span>
              <h3>Shift Confirmed!</h3>
              <p>
                You’re registered for <b>{claimedShiftModal.title}</b> with <b>{claimedShiftModal.orgName}</b>.
              </p>
              <div className="claim-details-box">
                <p>📍 <b>Location:</b> {claimedShiftModal.location}</p>
                <p>⏱ <b>Time:</b> {shiftWhen(claimedShiftModal)}</p>
                <p>📝 <b>Instructions:</b> Wear comfortable closed-toe shoes. Check in with the site lead upon arrival.</p>
              </div>
              <AddToCalendar shift={claimedShiftModal} />

              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setClaimedShiftModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
