import React, { useState } from 'react';
import { API_URL } from '../../../config';
import authStorage from '../../../app/authStorage';
import addBtnIcon from '../../../assets/icons/Add.svg';
import deleteIcon from '../../../assets/icons/delete.svg';
import { toDateInputValue, formatOfferDuration, parseOfferDuration, normalizeBadgeType } from '../../../utils/offerDuration';

import './Offers.css';

// Custom icons inline SVGs
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

// 1. Combo Offer circular badge
const ComboOfferBadge = ({ type }) => (
  <div className={`combo-offer-badge ${type === 'veg' ? 'veg-combo' : ''}`}>
    <div className="badge-inner">
      <span className="badge-text-top">COMBO</span>
      <span className="badge-text-bottom">OFFER</span>
    </div>
  </div>
);

// 2. Red Tag Badge with % symbol
const PercentTagBadge = () => (
  <div className="percent-tag-badge-wrapper">
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none" style={{ transform: 'rotate(-5deg)' }}>
      <path d="M22 6 C18 6 12 12 18 18" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M15 15 L28 15 L38 25 L25 38 L15 28 Z" fill="#e11d48" stroke="#ffffff" strokeWidth="1.2" />
      <circle cx="19" cy="19" r="2.2" fill="#ffffff" />
      <text x="22" y="30" fill="#ffffff" fontSize="12" fontWeight="900" fontFamily="sans-serif">%</text>
    </svg>
  </div>
);

// 3. Weekend Vibe rectangular badge
const WeekendOfferBadge = () => (
  <div className="weekend-offer-badge">
    <span className="weekend-offer-title">WEEKEND</span>
    <span className="weekend-offer-subtitle">OFFER</span>
  </div>
);

function Offers({ offers, setOffers }) {

  // Modal open state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Offer being edited (null while creating a new one)
  const [editingOffer, setEditingOffer] = useState(null);
  // Dates the edit form was prefilled with (to detect an untouched duration)
  const [initialDates, setInitialDates] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // New offer form states
  const getTodayDateString = () => toDateInputValue(new Date());

  const getFutureDateString = (monthsAhead = 1) => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsAhead);
    return toDateInputValue(d);
  };

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getFutureDateString(1));
  const [timing, setTiming] = useState('B/L/D');
  const [pricePercent, setPricePercent] = useState('');
  const [badgeType, setBadgeType] = useState('combo-offer');

  const resetForm = () => {
    setName('');
    setStartDate(getTodayDateString());
    setEndDate(getFutureDateString(1));
    setTiming('B/L/D');
    setPricePercent('');
    setBadgeType('combo-offer');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOffer(null);
    setInitialDates(null);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingOffer(null);
    setInitialDates(null);
    setIsModalOpen(true);
  };

  // Open the offer form prefilled with an existing offer
  const openEditModal = (offer) => {
    const parsedDates = parseOfferDuration(offer.duration);
    const dates = parsedDates || { startDate: getTodayDateString(), endDate: getFutureDateString(1) };
    setName(offer.name || '');
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    setTiming(offer.timing || 'B/L/D');
    setPricePercent(offer.pricePercent || '');
    setBadgeType(normalizeBadgeType(offer.badgeType));
    setInitialDates(dates);
    setEditingOffer(offer);
    setIsModalOpen(true);
  };

  // Toggle active/inactive state of offer
  const handleToggleActive = async (id) => {
    const offer = offers.find(o => o.id === id);
    if (!offer) return;
    const nextActive = !offer.isActive;

    try {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/api/offers/${id}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: nextActive })
      });
      if (response.ok) {
        setOffers(prev => prev.map(o => {
          if (o.id === id) {
            return {
              ...o,
              isActive: nextActive,
              status: nextActive ? 'Active' : 'Inactive'
            };
          }
          return o;
        }));
      } else {
        alert('Failed to toggle offer status');
      }
    } catch (err) {
      console.error('Error toggling offer:', err);
      alert('Failed to toggle offer status');
    }
  };

  // Toggle checked status for delete
  const handleToggleChecked = (id) => {
    setOffers(prev => prev.map(offer => {
      if (offer.id === id) {
        return {
          ...offer,
          checked: !offer.checked
        };
      }
      return offer;
    }));
  };

  // Delete checked offers
  const handleDeleteSelected = async () => {
    const checkedIds = offers.filter(o => o.checked).map(o => o.id);
    if (checkedIds.length === 0) return;

    try {
      const token = authStorage.getToken();
      const response = await fetch(`${API_URL}/api/offers/delete-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: checkedIds })
      });
      if (response.ok) {
        setOffers(prev => prev.filter(offer => !offer.checked));
      } else {
        alert('Failed to delete selected offers');
      }
    } catch (err) {
      console.error('Error deleting offers:', err);
      alert('Failed to delete selected offers');
    }
  };

  // Create a new offer, or save changes to the offer being edited
  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim() || !pricePercent.trim() || !startDate || !endDate) return;
    if (endDate < startDate) {
      alert('End date must be on or after the start date.');
      return;
    }

    // Keep the stored duration text when editing and the dates were not changed
    const datesUntouched = !!editingOffer && !!initialDates
      && initialDates.startDate === startDate && initialDates.endDate === endDate;
    const duration = datesUntouched && editingOffer.duration
      ? editingOffer.duration
      : formatOfferDuration(startDate, endDate);

    const payload = {
      name: name.trim(),
      badgeType,
      duration,
      timing,
      pricePercent: pricePercent.trim()
    };

    const isEdit = !!editingOffer;
    setIsSaving(true);
    try {
      const token = authStorage.getToken();
      const response = await fetch(
        isEdit ? `${API_URL}/api/offers/${editingOffer.id}` : `${API_URL}/api/offers`,
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );
      const data = await response.json();
      if (response.ok && data.offer) {
        if (isEdit) {
          setOffers(prev => prev.map(o => (
            o.id === editingOffer.id ? { ...o, ...data.offer, checked: o.checked } : o
          )));
        } else {
          setOffers(prev => [...prev, data.offer]);
        }
        resetForm();
        closeModal();
      } else {
        alert(data.message || (isEdit ? 'Failed to update offer' : 'Failed to create offer'));
      }
    } catch (err) {
      console.error(isEdit ? 'Error updating offer:' : 'Error creating offer:', err);
      alert(isEdit ? 'Failed to update offer' : 'Failed to create offer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="offers-page-container" style={{ position: 'relative', minHeight: '80vh', paddingBottom: '80px' }}>
      <h2 className="landing_heading2" style={{ color: 'var(--text-dark)', margin: '0 0 24px 0' }}>Offer</h2>

      <div className="offers-list">
        {offers.length > 0 ? (
          offers.map(offer => (
            <div key={offer.id} className={`offer-row-card ${!offer.isActive ? 'inactive-row' : ''}`}>
              {/* Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  className="offer-row-checkbox"
                  checked={offer.checked}
                  onChange={() => handleToggleChecked(offer.id)}
                />
              </div>

              {/* Toggle Switch */}
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
                <label className="offer-toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={offer.isActive}
                    onChange={() => handleToggleActive(offer.id)}
                  />
                  <span className="offer-toggle-slider"></span>
                </label>
              </div>

              {/* Badge Icon */}
              <div className="offer-badge-col" style={{ marginLeft: '16px', width: '56px', display: 'flex', justifyContent: 'center' }}>
                {(offer.badgeType === 'combo-offer' || offer.badgeType === 'combo-biriyani' || offer.badgeType === 'combo-veg') && <ComboOfferBadge />}
                {(offer.badgeType === 'discount' || offer.badgeType === 'percent-paneer') && <PercentTagBadge />}
                {(offer.badgeType === 'weekend-offer' || offer.badgeType === 'weekend-vibe') && <WeekendOfferBadge />}
              </div>

              {/* Columns Details */}
              <div className="offer-details-grid">
                <div className="offer-detail-col">
                  <span className="offer-col-label landing_body">Offer name</span>
                  <span className="offer-col-value landing_body">{offer.name}</span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label landing_body">Duration</span>
                  <span className="offer-col-value landing_body">{offer.duration}</span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label landing_body">Status</span>
                  <span className={`offer-col-value status-badge landing_body ${offer.isActive ? 'active' : 'inactive'}`}>
                    {offer.status}
                  </span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label landing_body">Timing</span>
                  <span className="offer-col-value landing_body">{offer.timing}</span>
                </div>

                <div className="offer-detail-col">
                  <span className="offer-col-label landing_body">Price/percentage</span>
                  <span className="offer-col-value landing_body">{offer.pricePercent}</span>
                </div>
              </div>

              {/* Edit action */}
              <button
                type="button"
                className="offer-edit-btn landing_button"
                onClick={() => openEditModal(offer)}
                title="Edit offer"
                aria-label={`Edit offer ${offer.name}`}
              >
                <EditIcon />
                Edit
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ background: 'var(--bg-white)', borderRadius: '8px', padding: '40px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <h4 className="landing_heading2" style={{ margin: '0 0 4px 0' }}>No offers active</h4>
            <p className="landing_body" style={{ margin: 0, color: 'var(--text-muted)' }}>Click the plus button to add a new marketing promotion.</p>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      {offers.some(o => o.checked) && (
        <button 
          className="fab-action-btn delete-btn-img-btn" 
          onClick={handleDeleteSelected}
          title="Delete Selected Offers"
          style={{
            position: 'fixed',
            bottom: '25px',
            right: '86px',
            zIndex: 100,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
        >
          <img src={deleteIcon} alt="Delete Selected" style={{ width: '50px', height: '56px', display: 'block' }} />
        </button>
      )}

      <button 
        className="fab-action-btn add-btn-img-btn" 
        onClick={openCreateModal}
        title="Add New Offer"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 100,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
      >
        <img src={addBtnIcon} alt="Add New Offer" style={{ width: '50px', height: '50px', display: 'block' }} />
      </button>

      {/* Add / Edit Offer Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content offer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title landing_heading2">{editingOffer ? 'Edit Offer' : 'Create New Offer'}</h3>
              <button className="modal-close-btn" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmitOffer}>
              <div className="form-group">
                <label className="form-label landing_body">Offer Name</label>
                <input 
                  type="text" 
                  className="form-input landing_placeholder" 
                  placeholder="e.g. Monsoon Special Combo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label landing_body">Duration</label>
                <div className="offer-duration-row">
                  <input 
                    type="date" 
                    className="form-input landing_placeholder" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required 
                  />
                  <span className="offer-duration-separator landing_body">to</span>
                  <input 
                    type="date" 
                    className="form-input landing_placeholder" 
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label landing_body">Price/percentage</label>
                  <input 
                    type="text" 
                    className="form-input landing_placeholder" 
                    placeholder="e.g. 150 Rs or 15%"
                    value={pricePercent}
                    onChange={(e) => setPricePercent(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label landing_body">Timing</label>
                  <select 
                    className="form-select landing_placeholder"
                    value={timing}
                    onChange={(e) => setTiming(e.target.value)}
                  >
                    <option value="B/L/D">B/L/D (Breakfast/Lunch/Dinner)</option>
                    <option value="L/D">L/D (Lunch/Dinner)</option>
                    <option value="B/L">B/L (Breakfast/Lunch)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label landing_body">Badge Style</label>
                <select 
                  className="form-select landing_placeholder"
                  value={badgeType}
                  onChange={(e) => setBadgeType(e.target.value)}
                >
                  <option value="combo-offer">Combo offer</option>
                  <option value="discount">Discount</option>
                  <option value="weekend-offer">weekend offer</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary landing_button" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary landing_button" disabled={isSaving}>
                  {isSaving ? 'Saving...' : (editingOffer ? 'Save Changes' : 'Create Offer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Offers;
