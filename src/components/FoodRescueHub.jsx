import React, { useEffect, useState } from 'react';
import { FOOD_RESCUE_LISTINGS } from '../data/communityData.js';
import { PLACES } from '../data/places.js';

/* A workspace page when `variant="page"`, and the modal it has always been
   otherwise. The page wrapper drops only what made it a popup: the backdrop's
   dismiss behaviour and the close button. */
export default function FoodRescueHub({ onClose, variant = 'modal' }) {
  const isPage = variant === 'page';
  const [listings, setListings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('neighbor-cart:rescue-dispatches') || '[]');
      return Array.isArray(saved) ? [...saved, ...FOOD_RESCUE_LISTINGS] : FOOD_RESCUE_LISTINGS;
    } catch {
      return FOOD_RESCUE_LISTINGS;
    }
  });
  const [showPostForm, setShowPostForm] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [foodType, setFoodType] = useState('');
  const [quantityLbs, setQuantityLbs] = useState('');
  const [storageReq, setStorageReq] = useState('Refrigerated');
  const [expirationDays, setExpirationDays] = useState('3 days');
  const [donorCity, setDonorCity] = useState('San Francisco, CA');
  const [dispatchNotice, setDispatchNotice] = useState(null);

  useEffect(() => {
    const newDispatches = listings.filter((item) => String(item.id).startsWith('res-')).filter((item) => !FOOD_RESCUE_LISTINGS.some((seed) => seed.id === item.id));
    localStorage.setItem('neighbor-cart:rescue-dispatches', JSON.stringify(newDispatches));
  }, [listings]);

  const totalRescuedLbs = listings.reduce((sum, item) => sum + item.quantityLbs, 0);
  const estimatedMeals = Math.round(totalRescuedLbs / 1.2);

  const handlePostSurplus = (e) => {
    e.preventDefault();
    const qty = parseInt(quantityLbs, 10) || 500;

    const city = donorCity.toLowerCase().split(',')[0].trim();
    // A candidate is never an automatic acceptance. This prioritizes verified
    // food banks, pantries, and meal programs in the donor's city for a human
    // capacity and food-safety confirmation.
    const matchedPantry = [...PLACES]
      .filter((place) => ['food-bank', 'pantry', 'hot-meal'].includes(place.type))
      .sort((a, b) => Number(b.city?.toLowerCase().includes(city)) - Number(a.city?.toLowerCase().includes(city)))[0] || PLACES[0];

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
      status: 'Recipient confirmation needed',
      driverAssigned: 'Not assigned',
      pickupWindow: 'Set by donor after recipient confirmation',
      workflowStep: 'recipient-review',
    };

    setListings([newListing, ...listings]);
    setShowPostForm(false);
    setDonorName('');
    setFoodType('');
    setQuantityLbs('');
    setDispatchNotice({
      recipient: matchedPantry.name,
      text: `Dispatch created. ${matchedPantry.name} is a suggested recipient; confirm their capacity, accepted items, and pickup time before assigning a driver.`,
    });
  };

  const claimPickup = (listing) => {
    if (listing.workflowStep === 'recipient-review') {
      setDispatchNotice({ recipient: listing.matchedOrg, text: `Waiting for ${listing.matchedOrg} to confirm capacity. A driver can be assigned after that confirmation.` });
      return;
    }
    setListings((current) => current.map((item) => item.id === listing.id
      ? { ...item, status: 'Driver assigned · Pickup scheduled', driverAssigned: 'You (volunteer driver)', workflowStep: 'pickup-scheduled' }
      : item));
  };

  return (
    <div
      className={`modal-backdrop${isPage ? ' is-page' : ''}`}
      onClick={isPage ? undefined : onClose}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      data-ai-section={isPage ? 'rescue' : undefined}
    >
      <div className="rescue-modal-card" onClick={isPage ? undefined : (e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rescue-header">
          <div>
            <span className="np-badge">🥦 Surplus Food Rescue Network</span>
            <h2 className="np-title">Food Rescue Dispatch & Matching</h2>
            <p className="np-sub">Connecting surplus food from grocers, bakeries, and farms with nearby food banks in real time.</p>
          </div>
          {!isPage && (
            <button className="modal-close" onClick={onClose} aria-label="Close rescue hub">×</button>
          )}
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

        {dispatchNotice && (
          <div className="rescue-dispatch-notice" role="status">
            <div><b>♻️ Dispatch update</b><span>{dispatchNotice.text}</span></div>
            <button type="button" onClick={() => setDispatchNotice(null)} aria-label="Dismiss dispatch update">×</button>
          </div>
        )}

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
                  onClick={() => claimPickup(item)}
                  disabled={item.workflowStep === 'pickup-scheduled'}
                >
                  {item.workflowStep === 'recipient-review' ? 'Await recipient confirmation' : item.workflowStep === 'pickup-scheduled' ? 'Pickup scheduled' : 'Claim pickup route'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
