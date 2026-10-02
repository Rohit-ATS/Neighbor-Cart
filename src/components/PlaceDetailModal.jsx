import React, { useState } from 'react';
import { getIsOpenNow } from '../data/places.js';

export default function PlaceDetailModal({ place, onClose, onOpenReserve }) {
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [inventoryTab, setInventoryTab] = useState('all');

  if (!place) return null;

  const openStatus = getIsOpenNow(place);
  const categories = ['all', ...new Set(place.inventory.map((i) => i.category))];
  const filteredInventory = inventoryTab === 'all' 
    ? place.inventory 
    : place.inventory.filter((i) => i.category === inventoryTab);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="detail-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="detail-modal-close" onClick={onClose} aria-label="Close details">×</button>

        {/* Photo Gallery Header */}
        <div className="detail-gallery">
          <div className="gallery-main-frame">
            <img 
              src={place.images[activeImgIdx] || place.images[0]} 
              alt={`${place.name} preview`} 
              className="gallery-main-img" 
            />
            <div className="gallery-overlay-badge">
              <span className={`status-pill ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}>
                {openStatus.isOpen ? '🟢' : '🔴'} {openStatus.text}
              </span>
            </div>
          </div>
          {place.images.length > 1 && (
            <div className="gallery-thumb-strip">
              {place.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`gallery-thumb-btn ${idx === activeImgIdx ? 'is-active' : ''}`}
                  onClick={() => setActiveImgIdx(idx)}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-body">
          {/* Main Title & Type */}
          <div className="detail-header">
            <div>
              <span className="detail-type-tag">{place.typeLabel}</span>
              <h2 className="detail-title">{place.name}</h2>
              <p className="detail-tagline">{place.tagline}</p>
            </div>
            {place.acceptsReservations && (
              <button 
                type="button" 
                className="reserve-btn-primary"
                onClick={() => onOpenReserve?.(place)}
              >
                📅 Reserve Food Box
              </button>
            )}
          </div>

          <div className="detail-grid-layout">
            {/* Left Column: Hours, Location, Contact, Services */}
            <div className="detail-info-col">
              {/* Quick Actions (Call, Directions, Website) */}
              <div className="action-button-row">
                <a href={place.directionsUrl} target="_blank" rel="noreferrer" className="action-pill-btn">
                  🧭 Directions
                </a>
                <a href={`tel:${place.phone.replace(/[^0-9]/g, '')}`} className="action-pill-btn">
                  📞 Call {place.phone}
                </a>
                <a href={place.website} target="_blank" rel="noreferrer" className="action-pill-btn">
                  🌐 Website
                </a>
              </div>

              {/* Address Card */}
              <div className="info-card">
                <h4 className="info-card-title">📍 Location</h4>
                <p className="info-card-text">
                  <b>{place.address}</b><br />
                  {place.cityStateZip}<br />
                  <span className="text-muted">Neighborhood: {place.neighborhood}</span>
                </p>
                <a href={place.directionsUrl} target="_blank" rel="noreferrer" className="text-link-accent">
                  Open Google Maps navigation →
                </a>
              </div>

              {/* Operating Hours */}
              <div className="info-card">
                <h4 className="info-card-title">⏱ Operating Schedule</h4>
                <p className="hours-highlight">{place.hoursSummary}</p>
                <div className="weekly-hours-table">
                  {place.weeklyHours.map((slot) => {
                    const isToday = slot.day === new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
                    return (
                      <div key={slot.day} className={`hours-row ${isToday ? 'is-today' : ''}`}>
                        <span className="day-name">{slot.day} {isToday && '★'}</span>
                        <span className="day-time">{slot.hours}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Requirements & Dignity */}
              <div className="info-card">
                <h4 className="info-card-title">🤝 Access & Requirements</h4>
                <p className="info-card-text">{place.requirements}</p>
                <ul className="service-bullet-list">
                  {place.services.map((svc, idx) => (
                    <li key={idx}>✓ {svc}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Column: Live Inventory Tracker */}
            <div className="detail-inventory-col">
              <div className="inventory-panel">
                <div className="inventory-header">
                  <div>
                    <span className="inventory-eyebrow">Real-Time Tracker</span>
                    <h3 className="inventory-title">Available Inventory</h3>
                  </div>
                  <span className="verified-badge">{place.verifiedDate}</span>
                </div>

                {/* Category filters */}
                <div className="inv-category-pills">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`inv-cat-pill ${inventoryTab === cat ? 'is-active' : ''}`}
                      onClick={() => setInventoryTab(cat)}
                    >
                      {cat === 'all' ? 'All Items' : cat}
                    </button>
                  ))}
                </div>

                {/* Inventory List */}
                <div className="inventory-items-grid">
                  {filteredInventory.map((item, idx) => (
                    <div key={idx} className="inv-item-card">
                      <div className="inv-item-top">
                        <span className="inv-item-category">{item.category}</span>
                        <span className={`stock-tag stock-${item.stock}`}>
                          {item.stock === 'high' ? 'High Supply' : item.stock === 'medium' ? 'Moderate' : 'Limited Stock'}
                        </span>
                      </div>
                      <h4 className="inv-item-name">{item.item}</h4>
                      <p className="inv-item-note">💬 {item.note}</p>
                    </div>
                  ))}
                </div>

                {place.acceptsReservations ? (
                  <div className="inventory-cta-box">
                    <p><b>Need a specific food box prepared for your family?</b></p>
                    <button 
                      type="button" 
                      className="btn-reserve-block"
                      onClick={() => onOpenReserve?.(place)}
                    >
                      Reserve Ahead For Pickup
                    </button>
                  </div>
                ) : (
                  <div className="inventory-cta-box walk-in-box">
                    <p>✨ <b>Walk-in Access:</b> This location operates on an open walk-up basis with no reservation required. Come during open hours!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
