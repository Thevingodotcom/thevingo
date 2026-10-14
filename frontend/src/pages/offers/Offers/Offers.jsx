import React, { useMemo, useState } from 'react';
import { API_URL } from '../../../config';
import authStorage from '../../../app/authStorage';
import addBtnIcon from '../../../assets/icons/Add.svg';
import deleteIcon from '../../../assets/icons/delete.svg';
import { formatOfferDuration, parseOfferDuration, normalizeBadgeType } from '../../../utils/offerDuration';
import {
  OFFER_STATUS_LABELS,
  addMonths,
  buildDishLookup,
  buildOfferPayload,
  buildOfferPreview,
  computeEffectiveStatus,
  daysBetween,
  describeOfferPrice,
  formatOfferDate,
  formatPrice,
  getOfferStatusKey,
  todayInOfferTimezone,
  validateOfferDraft
} from '../../../utils/offerPricing';
import OfferDishPicker from './OfferDishPicker';

import './Offers.css';

// Custom icons inline SVGs
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
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

const OfferBadge = ({ badgeType }) => (
  <>
    {(badgeType === 'combo-offer' || badgeType === 'combo-biriyani' || badgeType === 'combo-veg') && <ComboOfferBadge />}
    {(badgeType === 'discount' || badgeType === 'percent-paneer') && <PercentTagBadge />}
    {(badgeType === 'weekend-offer' || badgeType === 'weekend-vibe') && <WeekendOfferBadge />}
  </>
);

const TIMING_LABELS = {
  'B/L/D': 'B/L/D (Breakfast/Lunch/Dinner)',
  'L/D': 'L/D (Lunch/Dinner)',
  'B/L': 'B/L (Breakfast/Lunch)'
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const amountText = (value) => (value == null || !Number.isFinite(Number(value)) ? '' : String(Number(value)));
const dishCountText = (n) => `${n} dish${n === 1 ? '' : 'es'}`;

// Old offers stored the discount as free text ("15%", "150", "150 Rs")
const legacyPercent = (text) => {
  const m = /^\s*(\d+(?:\.\d{1,2})?)\s*%\s*$/.exec(String(text || ''));
  return m ? m[1] : '';
};
const legacyAmount = (text) => {
  const m = /^\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|rs\.?)?\s*$/i.exec(String(text || ''));
  return m ? m[1] : '';
};

const statusTitle = (offer, key) => {
  if (key === 'scheduled' && offer.startDate) return `Starts ${formatOfferDate(offer.startDate)}`;
  if (key === 'expired' && offer.endDate) return `Ended ${formatOfferDate(offer.endDate)}`;
  if (key === 'unscheduled') return 'Edit this offer to choose its dates and dishes';
  if (key === 'inactive') return 'Switched off';
  return undefined;
};

function Offers({ offers, setOffers, categories = [] }) {

  // Modal open state
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 'form' -> 'preview' (-> confirm dialog -> save)
  const [step, setStep] = useState('form');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  // Offer being edited (null while creating a new one)
  const [editingOffer, setEditingOffer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Informational messages shown at the top of the form (legacy offer, removed dishes)
  const [notices, setNotices] = useState([]);
  const [touched, setTouched] = useState({});

  // Form fields
  const [name, setName] = useState('');
  const [offerType, setOfferType] = useState('discount');
  const [discountMode, setDiscountMode] = useState('percentage');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timing, setTiming] = useState('B/L/D');
  const [badgeType, setBadgeType] = useState('discount');
  const [badgeTouched, setBadgeTouched] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [fixedPrices, setFixedPrices] = useState({});

  const dishLookup = useMemo(() => buildDishLookup(categories), [categories]);

  const draft = {
    name, offerType, discountMode, discountPercentage, comboPrice, startDate, endDate, selectedIds, fixedPrices
  };
  const { valid, errors } = validateOfferDraft(draft, dishLookup);
  const preview = step === 'preview' && valid ? buildOfferPreview(draft, dishLookup) : null;
  const touch = (field) => setTouched(prev => (prev[field] ? prev : { ...prev, [field]: true }));
  const visibleError = (field) => (touched[field] ? errors[field] : null);
  // Per-dish errors only once the owner has typed into that dish's price
  const visibleFixedErrors = Object.fromEntries(
    Object.entries(errors.fixedPrices || {}).filter(([id]) => fixedPrices[id] !== undefined)
  );
  const firstError = errors.name || errors.dates || errors.discountPercentage || errors.comboPrice
    || errors.dishes || (errors.fixedPrices ? 'Enter a valid offer price for each selected dish.' : null);

  const resetForm = () => {
    const today = todayInOfferTimezone();
    setName('');
    setOfferType('discount');
    setDiscountMode('percentage');
    setDiscountPercentage('');
    setComboPrice('');
    setStartDate(today);
    setEndDate(addMonths(today, 1));
    setTiming('B/L/D');
    setBadgeType('discount');
    setBadgeTouched(false);
    setSelectedIds([]);
    setFixedPrices({});
    setTouched({});
    setNotices([]);
    setSaveError('');
    setStep('form');
    setIsConfirmOpen(false);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setIsConfirmOpen(false);
    setStep('form');
    setEditingOffer(null);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingOffer(null);
    setIsModalOpen(true);
  };

  // Open the offer form prefilled with an existing offer
  const openEditModal = (offer) => {
    resetForm();
    const hasDates = DATE_RE.test(offer.startDate || '') && DATE_RE.test(offer.endDate || '');
    const isLegacy = !offer.offerType || !hasDates;
    const badge = normalizeBadgeType(offer.badgeType);
    const type = offer.offerType === 'combo' || (isLegacy && badge === 'combo-offer') ? 'combo' : 'discount';

    let dates = hasDates ? { startDate: offer.startDate, endDate: offer.endDate } : parseOfferDuration(offer.duration);
    if (!dates) {
      const today = todayInOfferTimezone();
      dates = { startDate: today, endDate: addMonths(today, 1) };
    }

    // Keep only dishes that still exist on the menu. If the menu hasn't loaded
    // yet, keep them all rather than treating every dish as removed.
    const linked = Array.isArray(offer.dishes) ? offer.dishes : [];
    const kept = dishLookup.size > 0 ? linked.filter(d => dishLookup.has(String(d.dishId))) : linked;
    const dropped = linked.length - kept.length;
    const prices = {};
    kept.forEach(d => {
      if (d.offerPrice != null) prices[String(d.dishId)] = amountText(d.offerPrice);
    });

    setName(offer.name || '');
    setOfferType(type);
    setDiscountMode(offer.discountMode === 'fixed' ? 'fixed' : 'percentage');
    setDiscountPercentage(offer.discountPercentage != null
      ? amountText(offer.discountPercentage)
      : (isLegacy && type === 'discount' ? legacyPercent(offer.pricePercent) : ''));
    setComboPrice(offer.comboPrice != null
      ? amountText(offer.comboPrice)
      : (isLegacy && type === 'combo' ? legacyAmount(offer.pricePercent) : ''));
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    setTiming(offer.timing || 'B/L/D');
    setBadgeType(badge);
    setBadgeTouched(true);
    setSelectedIds([...new Set(kept.map(d => String(d.dishId)))]);
    setFixedPrices(prices);

    const nextNotices = [];
    if (isLegacy) {
      nextNotices.push('This offer was created before dish selection was available. Check its type and dates, choose its dishes, then preview to update it.');
    }
    if (dropped > 0) {
      nextNotices.push(`${dropped} dish${dropped === 1 ? ' in this offer is' : 'es in this offer are'} no longer on your menu and ${dropped === 1 ? 'was' : 'were'} removed from the selection.`);
    }
    setNotices(nextNotices);
    setEditingOffer(offer);
    setIsModalOpen(true);
  };

  const handleOfferTypeChange = (type) => {
    setOfferType(type);
    if (!badgeTouched) setBadgeType(type === 'combo' ? 'combo-offer' : 'discount');
  };

  const handleFixedPriceChange = (id, value) => {
    setFixedPrices(prev => ({ ...prev, [id]: value }));
  };

  const handleDishesChange = (ids) => {
    setSelectedIds(ids);
    touch('dishes');
  };

  // Form -> preview (nothing is sent yet)
  const handlePreview = (e) => {
    e.preventDefault();
    if (!valid) {
      setTouched({ name: true, dates: true, dishes: true, discountPercentage: true, comboPrice: true });
      return;
    }
    setSaveError('');
    setStep('preview');
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
              status: nextActive ? 'Active' : 'Inactive',
              // Keep the schedule-aware status in sync with the toggle
              ...(o.effectiveStatus
                ? { effectiveStatus: computeEffectiveStatus({ isActive: nextActive, startDate: o.startDate, endDate: o.endDate }) }
                : {})
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

  // Confirmed: create the offer, or save changes to the offer being edited
  const handleConfirmSave = async () => {
    if (isSaving || !valid) return;
    const isEdit = !!editingOffer;
    const payload = buildOfferPayload(draft, {
      badgeType,
      timing,
      isActive: isEdit ? editingOffer.isActive !== false : true
    });

    setIsSaving(true);
    setSaveError('');
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
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.offer) {
        if (isEdit) {
          setOffers(prev => prev.map(o => (
            o.id === editingOffer.id ? { ...o, ...data.offer, checked: !!o.checked } : o
          )));
        } else {
          setOffers(prev => [...prev, { checked: false, ...data.offer }]);
        }
        setIsSaving(false);
        setIsConfirmOpen(false);
        setIsModalOpen(false);
        setStep('form');
        setEditingOffer(null);
        return;
      }
      setSaveError(data.message || (isEdit ? 'Failed to update offer' : 'Failed to create offer'));
    } catch (err) {
      console.error(isEdit ? 'Error updating offer:' : 'Error creating offer:', err);
      setSaveError(isEdit ? 'Failed to update offer' : 'Failed to create offer');
    }
    setIsSaving(false);
    setIsConfirmOpen(false);
  };

  // Where the offer will stand once saved (for the preview)
  const scheduleHint = () => {
    const today = todayInOfferTimezone();
    const willBeOn = editingOffer ? editingOffer.isActive !== false : true;
    const status = computeEffectiveStatus({ isActive: willBeOn, startDate, endDate }, today);
    if (status === 'inactive') {
      return { status, text: 'This offer is switched off. Turn it on from the offers list to show it on your menu.' };
    }
    if (status === 'scheduled') {
      const days = daysBetween(today, startDate);
      return { status, text: `Starts in ${days} day${days === 1 ? '' : 's'} and goes live automatically on ${formatOfferDate(startDate)}.` };
    }
    if (status === 'expired') {
      return { status, text: "The end date has already passed, so this offer will show as Expired and won't appear on your menu." };
    }
    return { status, text: editingOffer ? 'Live on your menu now.' : 'Goes live on your menu as soon as you publish.' };
  };

  const isEdit = !!editingOffer;
  const scheduleText = startDate && endDate ? `${formatOfferDate(startDate)} → ${formatOfferDate(endDate)}` : '';

  const renderForm = () => (
    <form onSubmit={handlePreview} noValidate>
      {notices.length > 0 && (
        <div className="offer-notice landing_body" role="status">
          <InfoIcon />
          <div>
            {notices.map(text => <p key={text}>{text}</p>)}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label landing_body" htmlFor="offer-name">Offer Name</label>
        <input
          id="offer-name"
          type="text"
          className={`form-input landing_placeholder ${visibleError('name') ? 'has-error' : ''}`}
          placeholder="e.g. Monsoon Special Combo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => touch('name')}
          required
        />
        {visibleError('name') && <span className="offer-field-error" role="alert">{visibleError('name')}</span>}
      </div>

      <div className="form-group">
        <span className="form-label landing_body" id="offer-type-label">Offer Type</span>
        <div className="offer-type-toggle" role="radiogroup" aria-labelledby="offer-type-label">
          {[
            { value: 'discount', label: 'Discount Offer', hint: 'Lower the price of chosen dishes' },
            { value: 'combo', label: 'Combo Offer', hint: 'Bundle dishes for one price' }
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={offerType === opt.value}
              className={`offer-type-option ${offerType === opt.value ? 'is-active' : ''}`}
              onClick={() => handleOfferTypeChange(opt.value)}
            >
              <span className="offer-type-option-label">{opt.label}</span>
              <span className="offer-type-option-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label landing_body" htmlFor="offer-start-date">Duration</label>
        <div className="offer-duration-row">
          <input
            id="offer-start-date"
            type="date"
            className="form-input landing_placeholder"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); touch('dates'); }}
            aria-label="Start date"
            required
          />
          <span className="offer-duration-separator landing_body">to</span>
          <input
            type="date"
            className="form-input landing_placeholder"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => { setEndDate(e.target.value); touch('dates'); }}
            aria-label="End date"
            required
          />
        </div>
        {visibleError('dates') && <span className="offer-field-error" role="alert">{visibleError('dates')}</span>}
      </div>

      {offerType === 'discount' ? (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label landing_body" htmlFor="offer-discount-mode">Discount type</label>
            <select
              id="offer-discount-mode"
              className="form-select landing_placeholder"
              value={discountMode}
              onChange={(e) => setDiscountMode(e.target.value)}
            >
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed offer price</option>
            </select>
          </div>

          <div className="form-group">
            {discountMode === 'percentage' ? (
              <>
                <label className="form-label landing_body" htmlFor="offer-discount-pct">Discount (%)</label>
                <input
                  id="offer-discount-pct"
                  type="text"
                  inputMode="decimal"
                  className={`form-input landing_placeholder ${visibleError('discountPercentage') ? 'has-error' : ''}`}
                  placeholder="e.g. 15"
                  value={discountPercentage}
                  onChange={(e) => { setDiscountPercentage(e.target.value); touch('discountPercentage'); }}
                />
                {visibleError('discountPercentage') && (
                  <span className="offer-field-error" role="alert">{visibleError('discountPercentage')}</span>
                )}
              </>
            ) : (
              <p className="offer-field-hint landing_body">Set an offer price for each selected dish below.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label landing_body" htmlFor="offer-combo-price">Combo price (Rs)</label>
          <input
            id="offer-combo-price"
            type="text"
            inputMode="decimal"
            className={`form-input landing_placeholder ${visibleError('comboPrice') ? 'has-error' : ''}`}
            placeholder="e.g. 499"
            value={comboPrice}
            onChange={(e) => { setComboPrice(e.target.value); touch('comboPrice'); }}
          />
          {selectedIds.length > 0 && (
            <span className="offer-field-hint landing_body">
              Dishes total: {formatPrice(selectedIds.reduce((sum, id) => sum + (dishLookup.get(id)?.price || 0), 0))}
            </span>
          )}
          {visibleError('comboPrice') && <span className="offer-field-error" role="alert">{visibleError('comboPrice')}</span>}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label landing_body" htmlFor="offer-timing">Timing</label>
          <select
            id="offer-timing"
            className="form-select landing_placeholder"
            value={timing}
            onChange={(e) => setTiming(e.target.value)}
          >
            <option value="B/L/D">B/L/D (Breakfast/Lunch/Dinner)</option>
            <option value="L/D">L/D (Lunch/Dinner)</option>
            <option value="B/L">B/L (Breakfast/Lunch)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label landing_body" htmlFor="offer-badge">Badge Style</label>
          <select
            id="offer-badge"
            className="form-select landing_placeholder"
            value={badgeType}
            onChange={(e) => { setBadgeType(e.target.value); setBadgeTouched(true); }}
          >
            <option value="combo-offer">Combo offer</option>
            <option value="discount">Discount</option>
            <option value="weekend-offer">weekend offer</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <span className="form-label landing_body">
          {offerType === 'combo' ? 'Dishes in this combo' : 'Dishes on offer'}
        </span>
        <OfferDishPicker
          categories={categories}
          selectedIds={selectedIds}
          onChange={handleDishesChange}
          mode={offerType === 'combo' ? 'combo' : discountMode}
          discountPercentage={discountPercentage}
          fixedPrices={fixedPrices}
          onFixedPriceChange={handleFixedPriceChange}
          fixedErrors={visibleFixedErrors}
        />
        {visibleError('dishes') && <span className="offer-field-error" role="alert">{visibleError('dishes')}</span>}
      </div>

      {!valid && firstError && (
        <p className="offer-preview-blocker landing_body">{firstError}</p>
      )}

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary landing_button" onClick={closeModal}>Cancel</button>
        <button type="submit" className="btn btn-primary landing_button" disabled={!valid}>
          Preview
        </button>
      </div>
    </form>
  );

  const renderPreview = () => {
    if (!preview) return null;
    const hint = scheduleHint();
    const isCombo = preview.offerType === 'combo';
    return (
      <div className="offer-preview">
        <div className="offer-preview-summary">
          <div className="offer-preview-badge"><OfferBadge badgeType={badgeType} /></div>
          <div className="offer-preview-heading">
            <span className="offer-preview-name">{name.trim()}</span>
            <span className="offer-preview-meta">
              {isCombo
                ? 'Combo offer'
                : preview.discountMode === 'fixed'
                  ? 'Discount offer · fixed prices'
                  : `Discount offer · ${preview.discountPercentage}% off`}
            </span>
          </div>
        </div>

        <dl className="offer-preview-facts">
          <div>
            <dt>Schedule</dt>
            <dd>{scheduleText}</dd>
          </div>
          <div>
            <dt>Timing</dt>
            <dd>{TIMING_LABELS[timing] || timing}</dd>
          </div>
        </dl>

        <p className={`offer-preview-status is-${hint.status}`}>{hint.text}</p>

        <div className="offer-preview-table" role="table" aria-label="Offer dishes">
          <div className={`offer-preview-tr offer-preview-th ${isCombo ? 'is-combo' : ''}`} role="row">
            <span role="columnheader">Dish</span>
            <span role="columnheader">{isCombo ? 'Price' : 'Original → Offer'}</span>
            {!isCombo && <span role="columnheader">Save</span>}
          </div>
          {preview.rows.map(row => (
            <div key={row.dishId} className={`offer-preview-tr ${isCombo ? 'is-combo' : ''}`} role="row" data-testid="offer-preview-row">
              <span role="cell" className="offer-preview-dish">
                {row.name}
                <small>{row.categoryName}</small>
              </span>
              {isCombo ? (
                <span role="cell">{formatPrice(row.originalPrice)}</span>
              ) : (
                <span role="cell" className="offer-preview-prices">
                  <s>{formatPrice(row.originalPrice)}</s>
                  <span aria-hidden="true"> → </span>
                  <strong>{formatPrice(row.offerPrice)}</strong>
                </span>
              )}
              {!isCombo && <span role="cell" className="offer-preview-save">{formatPrice(row.savings)}</span>}
            </div>
          ))}
        </div>

        <dl className="offer-preview-totals" aria-label="Offer totals">
          <div>
            <dt>Dishes</dt>
            <dd>{preview.dishCount}</dd>
          </div>
          <div>
            <dt>Original total</dt>
            <dd>{formatPrice(preview.originalTotal)}</dd>
          </div>
          <div>
            <dt>{isCombo ? 'Combo price' : 'Offer total'}</dt>
            <dd>{formatPrice(preview.offerTotal)}</dd>
          </div>
          <div className="offer-preview-total-savings">
            <dt>{isCombo ? 'Customer saves' : 'Total savings'}</dt>
            <dd>{formatPrice(preview.totalSavings)} ({preview.percentOff}% off)</dd>
          </div>
        </dl>

        <p className="offer-field-hint landing_body">Your menu's dish prices stay unchanged.</p>

        {saveError && <div className="offer-save-error" role="alert">{saveError}</div>}

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary landing_button" onClick={() => setStep('form')} disabled={isSaving}>
            Back
          </button>
          <button type="button" className="btn btn-primary landing_button" onClick={() => setIsConfirmOpen(true)} disabled={isSaving}>
            {isEdit ? 'Save changes' : 'Publish offer'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="offers-page-container" style={{ position: 'relative', minHeight: '80vh', paddingBottom: '80px' }}>
      <h2 className="landing_heading2" style={{ color: 'var(--text-dark)', margin: '0 0 24px 0' }}>Offer</h2>

      <div className="offers-list">
        {offers.length > 0 ? (
          offers.map(offer => {
            const statusKey = getOfferStatusKey(offer);
            const dishCount = Array.isArray(offer.dishes) ? offer.dishes.length : 0;
            const duration = offer.startDate && offer.endDate
              ? formatOfferDuration(offer.startDate, offer.endDate)
              : offer.duration;
            const dimmed = statusKey === 'inactive' || statusKey === 'expired';
            return (
              <div key={offer.id} className={`offer-row-card ${dimmed ? 'inactive-row' : ''}`}>
                {/* Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    className="offer-row-checkbox"
                    checked={!!offer.checked}
                    onChange={() => handleToggleChecked(offer.id)}
                    aria-label={`Select offer ${offer.name}`}
                  />
                </div>

                {/* Toggle Switch */}
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
                  <label className="offer-toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!offer.isActive}
                      onChange={() => handleToggleActive(offer.id)}
                      aria-label={`Turn offer ${offer.name} ${offer.isActive ? 'off' : 'on'}`}
                    />
                    <span className="offer-toggle-slider"></span>
                  </label>
                </div>

                {/* Badge Icon */}
                <div className="offer-badge-col" style={{ marginLeft: '16px', width: '56px', display: 'flex', justifyContent: 'center' }}>
                  <OfferBadge badgeType={offer.badgeType} />
                </div>

                {/* Columns Details */}
                <div className="offer-details-grid">
                  <div className="offer-detail-col">
                    <span className="offer-col-label landing_body">Offer name</span>
                    <span className="offer-col-value landing_body">{offer.name}</span>
                    {dishCount > 0 && (
                      <span className="offer-col-sub landing_body">
                        {offer.offerType === 'combo' ? 'Combo' : 'Discount'} · {dishCountText(dishCount)}
                      </span>
                    )}
                  </div>

                  <div className="offer-detail-col">
                    <span className="offer-col-label landing_body">Duration</span>
                    <span className="offer-col-value landing_body">{duration}</span>
                  </div>

                  <div className="offer-detail-col">
                    <span className="offer-col-label landing_body">Status</span>
                    <span
                      className={`offer-col-value status-badge landing_body ${statusKey}`}
                      title={statusTitle(offer, statusKey)}
                      data-testid="offer-status"
                    >
                      {OFFER_STATUS_LABELS[statusKey]}
                    </span>
                  </div>

                  <div className="offer-detail-col">
                    <span className="offer-col-label landing_body">Timing</span>
                    <span className="offer-col-value landing_body">{offer.timing}</span>
                  </div>

                  <div className="offer-detail-col">
                    <span className="offer-col-label landing_body">Price/percentage</span>
                    <span className="offer-col-value landing_body">{describeOfferPrice(offer)}</span>
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
            );
          })
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
          className="fab-action-btn delete-btn-img-btn menu-fab-wrapper"
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
        className="fab-action-btn add-btn-img-btn menu-fab-wrapper"
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

      {/* Add / Edit Offer Modal: form -> preview */}
      {isModalOpen && (
        <div className="modal-overlay offer-modal-overlay" onClick={closeModal}>
          <div
            className="modal-content offer-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="offer-modal-title" className="modal-title landing_heading2">
                {step === 'preview'
                  ? 'Preview Offer'
                  : (isEdit ? 'Edit Offer' : 'Create New Offer')}
              </h3>
              <button type="button" className="modal-close-btn" onClick={closeModal} aria-label="Close">×</button>
            </div>

            {step === 'preview' && preview ? renderPreview() : renderForm()}
          </div>
        </div>
      )}

      {/* Confirmation before anything is sent */}
      {isModalOpen && isConfirmOpen && preview && (
        <div className="modal-overlay offer-confirm-overlay" onClick={() => !isSaving && setIsConfirmOpen(false)}>
          <div
            className="category-modal-content"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="offer-confirm-title"
            aria-describedby="offer-confirm-desc"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !isSaving) setIsConfirmOpen(false);
            }}
          >
            <div className="category-modal-header">
              <h3 id="offer-confirm-title" className="category-modal-title">
                {isEdit ? 'Save changes?' : 'Publish this offer?'}
              </h3>
            </div>

            <div className="offer-confirm-body">
              <p id="offer-confirm-desc" className="offer-confirm-text">
                {isEdit ? 'Update ' : 'Publish '}<strong>"{name.trim()}"</strong>{' '}
                {preview.offerType === 'combo'
                  ? `as a combo of ${dishCountText(preview.dishCount)} for ${formatPrice(preview.comboPrice)}`
                  : `with a discount on ${dishCountText(preview.dishCount)}`}
                , running {scheduleText}?
              </p>
              <div className="offer-confirm-note">
                <InfoIcon />
                <span>
                  Customers see the offer on your public menu only while it is active. Your dishes' regular prices are not changed.
                </span>
              </div>

              <div className="category-modal-footer">
                <button
                  type="button"
                  className="btn-create-category"
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : (isEdit ? 'Save changes' : 'Publish')}
                </button>
                <button
                  type="button"
                  className="btn-cancel-category"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={isSaving}
                  autoFocus
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Offers;
