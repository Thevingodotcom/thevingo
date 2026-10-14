import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL, DEFAULT_DISH_IMAGE, getImageUrl } from '../../config';
import { getPersistentDeviceId } from '../../utils/device';
import catFilterIcon from '../../assets/icons/Catagory Filter.svg';
import filterIcon from '../../assets/icons/filterIcon.svg';
import { comboAnchorId, filterCombos, getComboIds, getDishOffer, normalizeCombos } from './offerDisplay';
import { ComboChip, ComboOffersSection, DishOfferPrice } from './PublicMenuOffers';
import './PublicMenu.css';

const COMBO_HIGHLIGHT_MS = 2000;

const PublicMenu = () => {
  const { userId } = useParams(); // This will receive the restaurant slug
  const [restaurantName, setRestaurantName] = useState('');
  const [tagline, setTagline] = useState('');
  const [categories, setCategories] = useState([]);
  // Active combo offers (top-level `combos`; [] on older backends that don't send it)
  const [combos, setCombos] = useState([]);
  const [highlightedComboId, setHighlightedComboId] = useState(null);
  const highlightTimerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCategoryPopover, setShowCategoryPopover] = useState(false);

  // Applied Filter states
  const [appliedAvailability, setAppliedAvailability] = useState({ Breakfast: true, Lunch: true, Dinner: true });
  const [appliedDishType, setAppliedDishType] = useState('all');

  // Temp Filter states (inside the modal)
  const [tempAvailability, setTempAvailability] = useState({ Breakfast: true, Lunch: true, Dinner: true });
  const [tempDishType, setTempDishType] = useState('all');

  const popoverRef = useRef(null);
  const floatingBtnRef = useRef(null);

  const handleOpenFilterModal = () => {
    setTempAvailability({ ...appliedAvailability });
    setTempDishType(appliedDishType);
    setShowFilterModal(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target) &&
        floatingBtnRef.current &&
        !floatingBtnRef.current.contains(event.target)
      ) {
        setShowCategoryPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => () => clearTimeout(highlightTimerRef.current), []);

  // "Part of a combo" chip: bring the combo card into view, focus it and flash a highlight.
  const jumpToCombo = (comboId) => {
    const card = document.getElementById(comboAnchorId(comboId));
    if (card) {
      if (typeof card.scrollIntoView === 'function') {
        const reduceMotion = typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      }
      try {
        card.focus({ preventScroll: true });
      } catch {
        // Older browsers without focus options
      }
    }
    setHighlightedComboId(comboId);
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedComboId(null), COMBO_HIGHLIGHT_MS);
  };

  const fetchMenu = async (showLoadingSpinner = true, isScan = false) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      const deviceId = getPersistentDeviceId();
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const qrId = searchParams.get('qr_id') || searchParams.get('qr') || searchParams.get('table') || 'default';

      const scanParams = isScan
        ? `&deviceId=${encodeURIComponent(deviceId)}&qrId=${encodeURIComponent(qrId)}`
        : `&sync=true&scan=0&deviceId=${encodeURIComponent(deviceId)}&qrId=${encodeURIComponent(qrId)}`;

      const response = await fetch(`${API_URL}/api/menu/public/${userId}?_t=${Date.now()}${scanParams}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'X-Device-Id': deviceId,
          ...(!isScan ? { 'x-menu-sync': 'true' } : {})
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        setRestaurantName(data.restaurant_name);
        setTagline(data.tagline);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setCombos(normalizeCombos(data.combos));
        setError(null);

        // Notify other tabs in same browser if a scan was counted
        if (data.scan_counted) {
          try {
            if (typeof BroadcastChannel !== 'undefined') {
              const scanBc = new BroadcastChannel('thevingo_scan_updates');
              scanBc.postMessage({
                type: 'SCAN_COUNT_UPDATED',
                scanCount: typeof data.scan_count === 'number' ? data.scan_count : null,
                timestamp: Date.now()
              });
              scanBc.close();
            }
          } catch {
            // Non-fatal
          }
        }
      } else {
        if (showLoadingSpinner) {
          setError(data.message || 'Failed to load menu.');
        }
      }
    } catch (err) {
      console.error('Fetch menu error:', err);
      if (showLoadingSpinner) {
        setError('Error connecting to the server.');
      }
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!userId) return;

    // 1. Initial menu load on scan (evaluates 2-hour device cooldown on backend)
    fetchMenu(true, true);

    // 2. Real-time updates via Server-Sent Events (SSE)
    let eventSource = null;
    try {
      eventSource = new EventSource(`${API_URL}/api/menu/public/${userId}/stream`);

      eventSource.addEventListener('menu-updated', () => {
        // Silently re-fetch updated menu data as background sync without counting a scan
        fetchMenu(false, false);
      });

      eventSource.onerror = () => {
        // Native EventSource automatically handles reconnection
      };
    } catch (sseErr) {
      console.warn('SSE connection warning:', sseErr);
    }

    // 3. Same-browser instant cross-tab sync via BroadcastChannel
    let broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel('thevingo_menu_updates');
        broadcastChannel.onmessage = () => {
          fetchMenu(false, false);
        };
      } catch (bcErr) {
        console.warn('BroadcastChannel warning:', bcErr);
      }
    }

    // 4. Automatic revalidation on tab focus or visibility change (does not increment scan)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchMenu(false, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [userId]);

  // Helper to format food availability
  const getAvailabilityText = (item) => {
    const list = [];
    if (item.availableBreakfast) list.push('Breakfast');
    if (item.availableLunch) list.push('Lunch');
    if (item.availableDinner) list.push('Dinner');
    if (list.length === 0) return 'Unavailable';
    return list.join('/');
  };

  if (loading) {
    return (
      <div className="public-menu-loading">
        <div className="spinner"></div>
        <p>Loading menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-menu-error">
        <h2>Oops!</h2>
        <p>{error}</p>
      </div>
    );
  }

  // Filter Categories and Items based on search query, availability, dish type, and selected category
  const filteredCategories = categories
    .map(category => {
      // 1. Category Filter
      if (selectedCategory !== 'all' && category.name !== selectedCategory) {
        return null;
      }

      // Filter dishes inside this category
      const filteredItems = category.items.filter(item => {
        // 1. Search Query
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        // 2. Availability filter
        let matchesAvailability = false;
        if (appliedAvailability.Breakfast && item.availableBreakfast) {
          matchesAvailability = true;
        }
        if (appliedAvailability.Lunch && item.availableLunch) {
          matchesAvailability = true;
        }
        if (appliedAvailability.Dinner && item.availableDinner) {
          matchesAvailability = true;
        }
        const noAvailabilityChecked = !appliedAvailability.Breakfast && !appliedAvailability.Lunch && !appliedAvailability.Dinner;
        if (noAvailabilityChecked) {
          matchesAvailability = true; // Show all if none checked
        }
        if (!matchesAvailability) return false;

        // 3. Dish Type filter
        let matchesDishType = true;
        if (appliedDishType === 'veg' && !item.isVeg) {
          matchesDishType = false;
        }
        if (appliedDishType === 'non-veg' && item.isVeg) {
          matchesDishType = false;
        }
        return matchesDishType;
      });

      // If category has no matching items, we don't display it
      if (filteredItems.length === 0) {
        return null;
      }

      return {
        ...category,
        items: filteredItems
      };
    })
    .filter(Boolean); // Remove null categories

  // Combos follow the search, dish type and category filters (see filterCombos)
  const visibleCombos = filterCombos(combos, {
    searchQuery,
    dishType: appliedDishType,
    selectedCategory,
    categories
  });
  const visibleCombosById = new Map(visibleCombos.map(combo => [combo.id, combo]));

  return (
    <div className="public-menu-page">
      {/* Header Section */}
      <header className="public-menu-header">
        <h1 className="public-menu-restaurant-name landing_heading1">{restaurantName || 'Restaurant Name'}</h1>
        <p className="public-menu-tagline landing_body2">{tagline || 'Tagline'}</p>
      </header>

      <main className="public-menu-main">
        {/* Search & Filter Row */}
        <div className="public-menu-search-row">
          <div className="public-menu-search-container">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="public-menu-search-input landing_placeholder"
            />
            <button className="public-menu-search-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
          <button 
            className="public-menu-filter-btn" 
            onClick={handleOpenFilterModal}
            title="Filter options"
          >
            <img src={filterIcon} alt="Filter" style={{ width: '38px', height: '38px', display: 'block' }} />
          </button>
        </div>

        {/* Combo Offers (above the categories; hidden when there are none) */}
        <ComboOffersSection combos={visibleCombos} highlightedId={highlightedComboId} />

        {/* Menu Sections */}
        <div className="public-menu-sections">
          {filteredCategories.length > 0 ? (
            filteredCategories.map(category => (
              <section key={category.id} className="public-category-section">
                <h3 className="public-category-title landing_heading2">{category.name}</h3>
                
                <div className="public-food-grid">
                  {category.items.length > 0 ? (
                    category.items.map(item => {
                      const offer = getDishOffer(item);
                      const itemCombos = getComboIds(item)
                        .map(id => visibleCombosById.get(id))
                        .filter(Boolean);
                      return (
                        <article key={item.id} className={`public-food-card${offer ? ' public-food-card--offer' : ''}`}>
                          <div className="public-food-card-body">
                            <div className="public-food-img-wrapper">
                              <img 
                                src={getImageUrl(item.image)} 
                                alt={item.name} 
                                className="public-food-img" 
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = DEFAULT_DISH_IMAGE;
                                }}
                              />
                            </div>
                            <div className="public-food-details">
                              <h4 className="public-food-name landing_body">{item.name}</h4>
                              {offer ? (
                                <DishOfferPrice offer={offer} />
                              ) : (
                                <p className="public-food-price landing_body">{item.price} Rs</p>
                              )}

                              {item.description && (
                                <p className="public-food-desc landing_body" style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 6px 0', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {item.description}
                                </p>
                              )}

                              <div className="public-veg-indicator">
                                <div className={`public-veg-box ${!item.isVeg ? 'non-veg' : ''}`}>
                                  <div className={`public-veg-dot ${!item.isVeg ? 'non-veg' : ''}`}></div>
                                </div>
                                <span className="public-veg-text landing_body">{item.isVeg ? 'Veg' : 'Non Veg'}</span>
                              </div>

                              <ComboChip combos={itemCombos} onJump={jumpToCombo} />
                            </div>
                          </div>
                          <div className="public-food-card-footer landing_body">
                            {getAvailabilityText(item) || 'Breakfast/Lunch/Dinner'}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="public-category-empty landing_body">
                      No matching dishes found.
                    </div>
                  )}
                </div>
              </section>
            ))
          ) : visibleCombos.length === 0 ? (
            <div className="public-menu-empty landing_body">
              No categories or dishes found.
            </div>
          ) : null}
        </div>
      </main>

      {/* Floating Orange Filter Button */}
      <button 
        ref={floatingBtnRef}
        className="public-menu-floating-filter-btn"
        onClick={() => setShowCategoryPopover(!showCategoryPopover)}
        title="Filter categories"
      >
        <img src={catFilterIcon} alt="Filter" style={{ width: '50px', height: '50px', display: 'block' }} />
      </button>

      {/* Category Filter Popover */}
      {showCategoryPopover && (
        <div ref={popoverRef} className="public-category-popover">
          <button 
            className={`public-category-popover-item landing_body ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('all');
              setShowCategoryPopover(false);
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              className={`public-category-popover-item landing_body ${selectedCategory === cat.name ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(cat.name);
                setShowCategoryPopover(false);
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter Modal Overlay */}
      {showFilterModal && (
        <div className="public-filter-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="public-filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="public-filter-modal-header" style={{ backgroundColor: '#F6F6F6', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h4 className="landing_heading2" style={{ margin: 0, color: 'var(--text-dark)' }}>Filter</h4>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              setAppliedAvailability(tempAvailability);
              setAppliedDishType(tempDishType);
              setShowFilterModal(false);
            }} style={{ padding: '20px' }}>
              
              {/* Availability Section */}
              <div className="filter-group">
                <label className="filter-label landing_body" style={{ display: 'block', marginBottom: '8px' }}>Availability</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <label className="landing_body" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      className="filter-checkbox-input"
                      checked={tempAvailability.Breakfast}
                      onChange={(e) => setTempAvailability(prev => ({ ...prev, Breakfast: e.target.checked }))}
                    />
                    Breakfast
                  </label>
                  <label className="landing_body" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      className="filter-checkbox-input"
                      checked={tempAvailability.Dinner}
                      onChange={(e) => setTempAvailability(prev => ({ ...prev, Dinner: e.target.checked }))}
                    />
                    Dinner
                  </label>
                  <label className="landing_body" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      className="filter-checkbox-input"
                      checked={tempAvailability.Lunch}
                      onChange={(e) => setTempAvailability(prev => ({ ...prev, Lunch: e.target.checked }))}
                    />
                    Lunch
                  </label>
                </div>
              </div>

              {/* Dish Type Section */}
              <div className="filter-group" style={{ marginTop: '20px' }}>
                <label className="filter-label landing_body" style={{ display: 'block', marginBottom: '8px' }}>Dish type</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <label className="landing_body" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="publicDishType"
                      className="filter-radio-input"
                      checked={tempDishType === 'veg'}
                      onChange={() => setTempDishType('veg')}
                    />
                    Veg
                  </label>
                  <label className="landing_body" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="publicDishType"
                      className="filter-radio-input"
                      checked={tempDishType === 'non-veg'}
                      onChange={() => setTempDishType('non-veg')}
                    />
                    Non Veg
                  </label>
                  <label className="landing_body" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="publicDishType"
                      className="filter-radio-input"
                      checked={tempDishType === 'all'}
                      onChange={() => setTempDishType('all')}
                    />
                    All
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="submit" className="filter-submit-btn landing_button">Filter</button>
                <button type="button" className="filter-cancel-btn landing_button" onClick={() => setShowFilterModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicMenu;
