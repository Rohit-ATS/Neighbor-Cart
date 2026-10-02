import React, { useState } from 'react';
import { VOLUNTEER_SHIFTS } from '../data/communityData.js';

export default function VolunteerHub({ onClose }) {
  const [shifts, setShifts] = useState(VOLUNTEER_SHIFTS);
  const [selectedTaskType, setSelectedTaskType] = useState('all');
  const [hoursLogged, setHoursLogged] = useState(14.5);
  const [claimedShiftModal, setClaimedShiftModal] = useState(null);

  const filteredShifts = shifts.filter((s) => {
    if (selectedTaskType !== 'all' && s.taskType !== selectedTaskType) return false;
    return true;
  });

  const handleClaimShift = (shift) => {
    setShifts(shifts.map((s) => s.id === shift.id ? { ...s, claimed: true, spotsAvailable: s.spotsAvailable - 1 } : s));
    setClaimedShiftModal(shift);
    setHoursLogged((prev) => prev + shift.hoursGranted);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="volunteer-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vol-header">
          <div>
            <span className="np-badge">🤝 Volunteer & Driver Network</span>
            <h2 className="np-title">Community Volunteer Opportunities</h2>
            <p className="np-sub">Claim food rescue pickups, warehouse sorting shifts, and mobile distribution routes.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close volunteer hub">×</button>
        </div>

        {/* Impact Bar */}
        <div className="vol-impact-summary">
          <div className="vol-impact-item">
            <span className="vii-val">{hoursLogged} hrs</span>
            <span className="vii-label">Your Logged Hours</span>
          </div>
          <div className="vol-impact-item">
            <span className="vii-val">~1,820 lbs</span>
            <span className="vii-label">Pounds Food Moved</span>
          </div>
          <div className="vol-impact-item">
            <span className="vii-val">1,516</span>
            <span className="vii-label">Estimated Meals Delivered</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="vol-filter-strip">
          <span className="filter-label">Filter Task:</span>
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
                <span className="vsc-spots">{shift.spotsAvailable} spots remaining</span>
              </div>
              <h3 className="vsc-title">{shift.title}</h3>
              <p className="vsc-org">🏢 <b>{shift.orgName}</b> · 📍 {shift.location}</p>
              <p className="vsc-date">⏱ {shift.date} ({shift.hoursGranted} hrs volunteer credit)</p>
              <p className="vsc-skills">💡 <b>Skills / Requirements:</b> {shift.skillsNeeded}</p>
              <p className="vsc-impact">🌟 <b>Impact:</b> {shift.impactEstimate}</p>

              <div className="vsc-actions">
                {shift.claimed ? (
                  <span className="vsc-claimed-badge">✓ You are registered for this shift!</span>
                ) : (
                  <button
                    type="button"
                    className="btn-primary small"
                    onClick={() => handleClaimShift(shift)}
                  >
                    Sign Up / Claim Shift
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Claim modal / confirmation */}
        {claimedShiftModal && (
          <div className="claim-confirm-overlay" onClick={() => setClaimedShiftModal(null)}>
            <div className="claim-confirm-box" onClick={(e) => e.stopPropagation()}>
              <span className="conf-icon">✓</span>
              <h3>Shift Confirmed!</h3>
              <p>You’re registered for <b>{claimedShiftModal.title}</b> at {claimedShiftModal.orgName}.</p>
              <div className="claim-details-box">
                <p>📍 <b>Location:</b> {claimedShiftModal.location}</p>
                <p>⏱ <b>Time:</b> {claimedShiftModal.date}</p>
                <p>📝 <b>Instructions:</b> Wear closed-toe shoes. Meet at loading dock B. A coordinator will greet you.</p>
              </div>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => setClaimedShiftModal(null)}
              >
                Done / Add to Calendar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
