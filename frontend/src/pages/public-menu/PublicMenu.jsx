import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../../config';
import catFilterIcon from '../../assets/icons/Catagory Filter.svg';
import filterIcon from '../../assets/icons/filterIcon.svg';
import './PublicMenu.css';

const PublicMenu = () => {
  const { userId } = useParams(); // This will receive the restaurant slug
  const [restaurantName, setRestaurantName] = useState('');
  const [tagline, setTagline] = useState('');
  const [categories, setCategories] = useState([]);
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

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/menu/public/${userId}`);
        const data = await response.json();
        
        if (response.ok) {
          setRestaurantName(data.restaurant_name);
          setTagline(data.tagline);
          setCategories(data.categories);
        } else {
          setError(data.message || 'Failed to load menu.');
        }
      } catch (err) {
        console.error(err);
        setError('Error connecting to the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [userId]);

  // Helper to format food availability
  const getAvailabilityText = (item) => {
    const list = [];
    if (item.availableBreakfast) list.push('Breakfast');
    if (item.availableLunch) list.push('Lunch');
    if (item.availableDinner) list.push('Dinner');
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

  return (
    <div className="public-menu-page">
      {/* Header Section */}
      <header className="public-menu-header">
        <h1 className="public-menu-restaurant-name">{restaurantName || 'Restaurant Name'}</h1>
        <p className="public-menu-tagline">{tagline || 'Tagline'}</p>
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
              className="public-menu-search-input"
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

        {/* Menu Sections */}
        <div className="public-menu-sections">
          {filteredCategories.length > 0 ? (
            filteredCategories.map(category => (
              <section key={category.id} className="public-category-section">
                <h3 className="public-category-title">{category.name}</h3>
                
                <div className="public-food-grid">
                  {category.items.length > 0 ? (
                    category.items.map(item => (
                      <article key={item.id} className="public-food-card">
                        <div className="public-food-card-body">
                          <div className="public-food-img-wrapper">
                            <img 
                              src={item.image || 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80'} 
                              alt={item.name} 
                              className="public-food-img" 
                            />
                          </div>
                          <div className="public-food-details">
                            <h4 className="public-food-name">{item.name}</h4>
                            <p className="public-food-price">{item.price} Rs</p>

                            <div className="public-veg-indicator">
                              <div className={`public-veg-box ${!item.isVeg ? 'non-veg' : ''}`}>
                                <div className={`public-veg-dot ${!item.isVeg ? 'non-veg' : ''}`}></div>
                              </div>
                              <span className="public-veg-text">{item.isVeg ? 'Veg' : 'Non Veg'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="public-food-card-footer">
                          {getAvailabilityText(item) || 'Breakfast/Lunch/Dinner'}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="public-category-empty">
                      No matching dishes found.
                    </div>
                  )}
                </div>
              </section>
            ))
          ) : (
            <div className="public-menu-empty">
              No categories or dishes found.
            </div>
          )}
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
            className={`public-category-popover-item ${selectedCategory === 'all' ? 'active' : ''}`}
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
              className={`public-category-popover-item ${selectedCategory === cat.name ? 'active' : ''}`}
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
              <h4 style={{ margin: 0, fontSize: 'var(--body-size)', fontWeight: 'var(--weight-bold)', color: '#111827' }}>Filter</h4>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              setAppliedAvailability(tempAvailability);
              setAppliedDishType(tempDishType);
              setShowFilterModal(false);
            }} style={{ padding: '20px' }}>
              
              {/* Availability Section */}
              <div className="filter-group">
                <label className="filter-label" style={{ display: 'block', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-bold)', color: '#111827', marginBottom: '8px' }}>Availability</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: '#1f2937' }}>
                    <input 
                      type="checkbox" 
                      className="filter-checkbox-input"
                      checked={tempAvailability.Breakfast}
                      onChange={(e) => setTempAvailability(prev => ({ ...prev, Breakfast: e.target.checked }))}
                    />
                    Breakfast
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: '#1f2937' }}>
                    <input 
                      type="checkbox" 
                      className="filter-checkbox-input"
                      checked={tempAvailability.Dinner}
                      onChange={(e) => setTempAvailability(prev => ({ ...prev, Dinner: e.target.checked }))}
                    />
                    Dinner
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: '#1f2937' }}>
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
                <label className="filter-label" style={{ display: 'block', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-bold)', color: '#111827', marginBottom: '8px' }}>Dish type</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: '#1f2937' }}>
                    <input 
                      type="radio" 
                      name="publicDishType"
                      className="filter-radio-input"
                      checked={tempDishType === 'veg'}
                      onChange={() => setTempDishType('veg')}
                    />
                    Veg
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: '#1f2937' }}>
                    <input 
                      type="radio" 
                      name="publicDishType"
                      className="filter-radio-input"
                      checked={tempDishType === 'non-veg'}
                      onChange={() => setTempDishType('non-veg')}
                    />
                    Non Veg
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: '#1f2937' }}>
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
                <button type="submit" className="filter-submit-btn">Filter</button>
                <button type="button" className="filter-cancel-btn" onClick={() => setShowFilterModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicMenu;
