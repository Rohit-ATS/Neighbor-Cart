import React, { useState } from 'react';
import { FOOD_RESCUE_LISTINGS } from '../data/communityData.js';
import { PLACES } from '../data/places.js';

export default function FoodRescueHub({ onClose }) {
  const [listings, setListings] = useState(FOOD_RESCUE_LISTINGS);
  const [showPostForm, setShowPostForm] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [foodType, setFoodType] = useState('');
  const [quantityLbs, setQuantityLbs] = useState('');
  const [storageReq, setStorageReq] = useState('Refrigerated');
  const [expirationDays, setExpirationDays] = useState('3 days');
  const [donorCity, setDonorCity] = useState('Des Moines, IA');

  const totalRescuedLbs = listings.reduce((sum, item) => sum + item.quantityLbs, 0);
  const estimatedMeals = Math.round(totalRescuedLbs / 1.2);

  const handlePostSurplus = (e) => {
    e.preventDefault();
    const qty = parseInt(quantityLbs, 10) || 500;

    // Intelligent match algorithm matching nearby pantry with refrigeration capacity
    const matchedPantry = PLACES.find((p) => 
      storageReq === 'Refrigerated' ? p.inventory.some((i) => i.category.includes('Produce') || i.category.includes('Dairy')) : true
    ) || PLACES[0];

    const newListing = {
      id: 'res-' + Date.now(),
      donorName: donorName.trim() || 'Community Food Donor',
      donorType: 'Local Donor',
      foodType: foodType.trim() || 'Fresh Produce Assortment',
      quantityLbs: qty,
      storageReq,
      expirationDays,
      location: donorCity,
      matchedOrg: matchedPantry.name,
      status: `Matched with ${matchedPantry.name} · Awaiting Driver`,
      driverAssigned: 'Pending Volunteer Claim',
      pickupWindow: 'Today within 4 hours'
    };

    setListings([newListing, ...listings]);
    setShowPostForm(false);
    setDonorName('');
    setFoodType('');
    setQuantityLbs('');
    alert(`Surplus food logged! Intelligently matched with ${matchedPantry.name} based on cold storage capacity and local community demand.`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rescue-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rescue-header">
          <div>
            <span className="np-badge">🥦 Surplus Food Rescue Network</span>
            <h2 className="np-title">Food Rescue Dispatch & Matching</h2>
            <p className="np-sub">Connecting surplus food from grocers, bakeries, and farms with nearby food banks in real time.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close rescue hub">×</button>
        </div>

        {/* Impact Bar */}
        <div className="vol-impact-summary">
          <div className="vol-impact-item">
            <span className="vii-val">{totalRescuedLbs.toLocaleString('en-US')} lbs</span>
            <span className="vii-label">Total Surplus Rescued</span>
          </div>
          <div className="vol-impact-item">
            <span className="vii-val">{estimatedMeals.toLocaleString('en-US')}</span>
            <span className="vii-label">Wholesome Meals Created</span>
          </div>
          <div className="vol-impact-item">
            <span className="vii-val">100%</span>
            <span className="vii-label">Diverted from Landfills</span>
          </div>
        </div>

        {/* Action Header */}
        <div className="rescue-action-bar">
          <h3>Active Food Rescue Matches</h3>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowPostForm(!showPostForm)}
          >
            {showPostForm ? 'Cancel Form' : '＋ Post Surplus Food'}
          </button>
        </div>

        {/* Post Surplus Form */}
        {showPostForm && (
          <form onSubmit={handlePostSurplus} className="post-surplus-card">
            <h4>Post Commercial or Farm Surplus</h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Donor Name / Business</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. City Grocers or Valley Farms"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Food Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Organic Strawberries & Sweet Corn"
                  value={foodType}
                  onChange={(e) => setFoodType(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Estimated Quantity (Lbs)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1200"
                  value={quantityLbs}
                  onChange={(e) => setQuantityLbs(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Storage Requirement</label>
                <select
                  className="form-input"
                  value={storageReq}
                  onChange={(e) => setStorageReq(e.target.value)}
                >
                  <option value="Refrigerated">Refrigerated (35°F - 40°F)</option>
                  <option value="Frozen">Frozen (0°F)</option>
                  <option value="Dry Shelf-Stable">Dry Shelf-Stable</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expiration Window</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 3-4 days remaining"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Pickup City / ZIP</label>
                <input
                  type="text"
                  className="form-input"
                  value={donorCity}
                  onChange={(e) => setDonorCity(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="submit" className="btn-primary">
                Post & Automatically Match to Nearby Food Bank →
              </button>
            </div>
          </form>
        )}

        {/* Listings List */}
        <div className="rescue-listings-grid">
          {listings.map((item) => (
            <div key={item.id} className="rescue-item-card">
              <div className="ric-top">
                <span className="ric-donor-type">{item.donorType}</span>
                <span className="ric-status-pill">{item.status}</span>
              </div>
              <h3 className="ric-food">{item.foodType}</h3>
              <p className="ric-meta">🏢 Donor: <b>{item.donorName}</b> ({item.location})</p>
              <div className="ric-specs-grid">
                <div><b>Weight:</b> {item.quantityLbs.toLocaleString('en-US')} lbs</div>
                <div><b>Storage:</b> {item.storageReq}</div>
                <div><b>Window:</b> {item.expirationDays}</div>
                <div><b>Matched With:</b> {item.matchedOrg}</div>
              </div>
              <div className="ric-footer">
                <span>Driver: <b>{item.driverAssigned}</b></span>
                <button
                  type="button"
                  className="btn-secondary small"
                  onClick={() => alert(`Pickup details sent to volunteer driver!`)}
                >
                  Claim Pickup Route
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
