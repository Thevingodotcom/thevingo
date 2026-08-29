import { useState, useEffect, useRef } from 'react';
import { API_URL, DEFAULT_DISH_IMAGE } from '../../../config';
import filterIcon from '../../../assets/icons/filterIcon.svg';
import searchIcon from '../../../assets/icons/search icon.svg';
import addBtnIcon from '../../../assets/icons/Add.svg';

// Inline Icons
const ThreeDotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5"></circle>
    <circle cx="12" cy="5" r="1.5"></circle>
    <circle cx="12" cy="19" r="1.5"></circle>
  </svg>
);

const FunnelIcon = () => (
  <img src={filterIcon} alt="Filter" style={{ width: '40px', height: '40px', display: 'block' }} />
);

const GlassIcon = () => (
  <img src={searchIcon} alt="Search" style={{ width: '40px', height: '40px', display: 'block' }} />
);

function MenuList({ categories, setCategories }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Custom Filter Dialog States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedCategory, setAppliedCategory] = useState('all');
  const [appliedAvailability, setAppliedAvailability] = useState({ Breakfast: true, Lunch: true, Dinner: true });
  const [appliedDishType, setAppliedDishType] = useState('all');

  const [tempFilterCategory, setTempFilterCategory] = useState('all');
  const [tempFilterAvailability, setTempFilterAvailability] = useState({ Breakfast: true, Lunch: true, Dinner: true });
  const [tempFilterDishType, setTempFilterDishType] = useState('all');

  const handleOpenFilterModal = () => {
    setTempFilterCategory(appliedCategory);
    setTempFilterAvailability({ ...appliedAvailability });
    setTempFilterDishType(appliedDishType);
    setIsFilterModalOpen(true);
  };

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setAppliedCategory(tempFilterCategory);
    setAppliedAvailability({ ...tempFilterAvailability });
    setAppliedDishType(tempFilterDishType);
    setIsFilterModalOpen(false);
  };

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('biriyani');
  const [newItemIsVeg, setNewItemIsVeg] = useState(true);
  const [newItemImage, setNewItemImage] = useState('');
  const [availBreakfast, setAvailBreakfast] = useState(true);
  const [availLunch, setAvailLunch] = useState(true);
  const [availDinner, setAvailDinner] = useState(true);
  const [fileName, setFileName] = useState('');
  const [imageFile, setImageFile] = useState(null);

  // FAB Pop-up menu states
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const fabRef = useRef(null);

  // Custom states for category dropdown and selection mode
  const [activeCategoryMenu, setActiveCategoryMenu] = useState(null);
  const [selectionCategoryId, setSelectionCategoryId] = useState(null);
  const [selectedDishIds, setSelectedDishIds] = useState([]);

  // Close category three-dot menu on click outside
  useEffect(() => {
    function handleClickOutsideCategoryMenu() {
      setActiveCategoryMenu(null);
    }
    if (activeCategoryMenu !== null) {
      document.addEventListener('click', handleClickOutsideCategoryMenu);
    }
    return () => {
      document.removeEventListener('click', handleClickOutsideCategoryMenu);
    };
  }, [activeCategoryMenu]);

  const handleToggleSelectDish = (dishId) => {
    setSelectedDishIds(prev => {
      if (prev.includes(dishId)) {
        return prev.filter(id => id !== dishId);
      } else {
        return [...prev, dishId];
      }
    });
  };

  const handleCancelSelection = () => {
    setSelectionCategoryId(null);
    setSelectedDishIds([]);
  };

  const handleDeleteSelectedDishes = async () => {
    if (selectedDishIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedDishIds.length} selected dishes?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/menu/dishes/delete-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dishIds: selectedDishIds })
      });

      if (response.ok) {
        setCategories(prev => prev.map(cat => {
          if (cat.id === selectionCategoryId) {
            return {
              ...cat,
              items: cat.items.filter(item => !selectedDishIds.includes(item.id))
            };
          }
          return cat;
        }));
        setSelectionCategoryId(null);
        setSelectedDishIds([]);
      } else {
        alert('Failed to delete selected dishes.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting selected dishes.');
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (!window.confirm(`Are you sure you want to delete the entire category "${categoryName}" and all dishes under it?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/menu/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setCategories(prev => prev.filter(cat => cat.id !== categoryId.toString() && cat.id !== categoryId));
        setActiveCategoryMenu(null);
      } else {
        alert('Failed to delete category.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting category.');
    }
  };

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const toggleFilter = () => {
    handleOpenFilterModal();
  };

  const handleAddItemSubmit = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;

    let defaultImg = newItemImage;
    if (!defaultImg) {
      defaultImg = DEFAULT_DISH_IMAGE;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('name', newItemName);
      formData.append('price', newItemPrice);
      formData.append('categoryId', newItemCategory);
      formData.append('isVeg', newItemIsVeg);
      formData.append('availableBreakfast', availBreakfast);
      formData.append('availableLunch', availLunch);
      formData.append('availableDinner', availDinner);

      if (imageFile) {
        formData.append('image', imageFile);
      } else {
        // Send defaultImg url in image field if no file is uploaded
        formData.append('image', defaultImg);
      }

      const response = await fetch(`${API_URL}/api/menu/dishes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(prev => prev.map(cat => {
          if (cat.id.toString() === newItemCategory.toString()) {
            return {
              ...cat,
              items: [...cat.items, data.dish]
            };
          }
          return cat;
        }));

        setNewItemName('');
        setNewItemPrice('');
        setNewItemIsVeg(true);
        setNewItemImage('');
        setImageFile(null);
        setAvailBreakfast(true);
        setAvailLunch(true);
        setAvailDinner(true);
        setFileName('');
        setIsModalOpen(false);
      } else {
        alert(data.message || 'Failed to create dish');
      }
    } catch (err) {
      console.error('Error adding dish:', err);
      alert('Failed to add dish');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
      setImageFile(file);
      setNewItemImage(URL.createObjectURL(file));
    }
  };

  const handleAddCategorySubmit = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/menu/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(prev => [...prev, data.category]);
        setNewCategoryName('');
        setIsCategoryModalOpen(false);
      } else {
        alert(data.message || 'Failed to create category');
      }
    } catch (err) {
      console.error('Error adding category:', err);
      alert('Failed to add category');
    }
  };

  const downloadTemplate = () => {
    const headers = ['Category', 'Dish Name', 'Price', 'Veg Type (veg/non_veg)', 'Breakfast (1/0)', 'Lunch (1/0)', 'Dinner (1/0)'];
    const row = ['Main Course', 'Paneer Butter Masala', '180', 'veg', '1', '1', '1'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "vingo_menu_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      if (lines.length <= 1) {
        alert('The uploaded template is empty.');
        return;
      }

      const token = localStorage.getItem('token');
      const rows = lines.slice(1).map(line => line.split(',')).filter(row => row.length >= 2 && row[0].trim());
      
      try {
        let importedCategories = [];
        
        for (const row of rows) {
          const categoryName = row[0].trim();
          const dishName = row[1].trim();
          const price = parseFloat(row[2]) || 0;
          const vegType = (row[3] || 'veg').trim().toLowerCase();
          const isVeg = vegType === 'veg';
          const availBreakfast = (row[4] || '1').trim() === '1';
          const availLunch = (row[5] || '1').trim() === '1';
          const availDinner = (row[6] || '1').trim() === '1';

          let category = importedCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
          if (!category) {
            const catResponse = await fetch(`${API_URL}/api/menu/categories`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ name: categoryName })
            });
            const catData = await catResponse.json();
            if (catResponse.ok) {
              category = catData.category;
              importedCategories.push(category);
            } else {
              console.error('Failed to auto-create category:', categoryName);
              continue;
            }
          }

          const dishResponse = await fetch(`${API_URL}/api/menu/dishes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: dishName,
              price: price,
              categoryId: category.id,
              isVeg: isVeg,
              image: DEFAULT_DISH_IMAGE,
              availableBreakfast: availBreakfast,
              availableLunch: availLunch,
              availableDinner: availDinner
            })
          });
          const dishData = await dishResponse.json();
          if (dishResponse.ok) {
            category.items.push(dishData.dish);
          }
        }

        setCategories(prev => [...prev, ...importedCategories]);
        setIsImportModalOpen(false);
        alert('Menu imported successfully!');
      } catch (err) {
        console.error('Import error:', err);
        alert('Error parsing or saving menu items.');
      }
    };
    reader.readAsText(file);
  };

  const filteredCategories = categories
    .filter(cat => {
      if (appliedCategory !== 'all') {
        return String(cat.id) === String(appliedCategory) || cat.name === appliedCategory;
      }
      return true;
    })
    .map(cat => {
      const filteredItems = cat.items.filter(item => {
        // Search Query filter
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Dish Type (Veg/Non Veg) filter
        let matchesDishType = true;
        if (appliedDishType === 'veg') {
          matchesDishType = item.isVeg === true || item.isVeg === 1 || item.isVeg === 'true';
        } else if (appliedDishType === 'non-veg') {
          matchesDishType = item.isVeg === false || item.isVeg === 0 || item.isVeg === 'false';
        }

        // Availability filter
        let matchesAvailability = false;
        if (appliedAvailability.Breakfast && (item.availableBreakfast === true || item.availableBreakfast === 1 || item.availableBreakfast === 'true')) {
          matchesAvailability = true;
        }
        if (appliedAvailability.Lunch && (item.availableLunch === true || item.availableLunch === 1 || item.availableLunch === 'true')) {
          matchesAvailability = true;
        }
        if (appliedAvailability.Dinner && (item.availableDinner === true || item.availableDinner === 1 || item.availableDinner === 'true')) {
          matchesAvailability = true;
        }
        const noAvailabilityChecked = !appliedAvailability.Breakfast && !appliedAvailability.Lunch && !appliedAvailability.Dinner;
        if (noAvailabilityChecked) {
          matchesAvailability = true;
        }

        return matchesSearch && matchesDishType && matchesAvailability;
      });

      return {
        ...cat,
        items: filteredItems
      };
    });

  const isAnyFilterActive = searchQuery.trim() || 
                            appliedCategory !== 'all' || 
                            appliedDishType !== 'all' || 
                            !appliedAvailability.Breakfast || 
                            !appliedAvailability.Lunch || 
                            !appliedAvailability.Dinner;

  const displayCategories = isAnyFilterActive
    ? filteredCategories.filter(cat => cat.items.length > 0)
    : filteredCategories;

  return (
    <>
      <div className="search-filter-container">
        <div className="search-bar-wrapper">
          <input
            type="text"
            placeholder="Search menu items..."
            className="search-input landing_placeholder"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="search-btn">
            <GlassIcon />
          </button>
        </div>

        <button
          className={`filter-btn ${filterType !== 'all' ? 'active' : ''}`}
          onClick={toggleFilter}
          title={`Filtering: ${filterType}. Click to change.`}
        >
          <FunnelIcon />
        </button>
        {(appliedCategory !== 'all' || appliedDishType !== 'all' || !appliedAvailability.Breakfast || !appliedAvailability.Lunch || !appliedAvailability.Dinner) && (
          <button 
            onClick={() => {
              setAppliedCategory('all');
              setAppliedAvailability({ Breakfast: true, Lunch: true, Dinner: true });
              setAppliedDishType('all');
            }}
            className="landing_anchor"
            style={{
              background: 'none',
              border: 'none',
              color: '#EF5C43',
              cursor: 'pointer'
            }}
          >
            Clear Filters ✕
          </button>
        )}
      </div>

      {categories.length > 0 ? (
        displayCategories.length > 0 ? (
          displayCategories.map(category => (
            <section key={category.id} className="category-section">
              <div className="category-header">
                <h3 className="category-title landing_heading2">{category.name}</h3>
                <div style={{ position: 'relative' }}>
                  <button 
                    className="category-options-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCategoryMenu(activeCategoryMenu === category.id ? null : category.id);
                    }}
                  >
                    <ThreeDotsIcon />
                  </button>
                  {activeCategoryMenu === category.id && (
                    <div className="category-dropdown-menu">
                      <button
                        type="button"
                        className="category-dropdown-item landing_body"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectionCategoryId(category.id);
                          setSelectedDishIds([]);
                          setActiveCategoryMenu(null);
                        }}
                      >
                        Delete dishes
                      </button>
                      <button
                        type="button"
                        className="category-dropdown-item delete-option landing_body"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category.id, category.name);
                        }}
                      >
                        Delete category
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="food-grid">
                {category.items.length > 0 ? (
                  category.items.map(item => (
                    <article 
                      key={item.id} 
                      className={`food-card ${selectionCategoryId === category.id && selectedDishIds.includes(item.id) ? 'selected' : ''}`}
                      onClick={() => {
                        if (selectionCategoryId === category.id) {
                          handleToggleSelectDish(item.id);
                        }
                      }}
                      style={{ cursor: selectionCategoryId === category.id ? 'pointer' : 'default', position: 'relative' }}
                    >
                      {selectionCategoryId === category.id && (
                        <div className="dish-select-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="offer-row-checkbox"
                            checked={selectedDishIds.includes(item.id)}
                            onChange={() => handleToggleSelectDish(item.id)}
                          />
                        </div>
                      )}
                      <div className="food-card-body">
                        <div className="food-img-wrapper">
                          <img src={item.image} alt={item.name} className="food-img" />
                        </div>
                        <div className="food-details">
                          <h4 className="food-name landing_body">{item.name}</h4>
                          <p className="food-price landing_body">{item.price} Rs</p>

                          <div className="veg-indicator">
                            <div className={`veg-box ${!item.isVeg ? 'non-veg' : ''}`}>
                              <div className={`veg-dot ${!item.isVeg ? 'non-veg' : ''}`}></div>
                            </div>
                            <span className="veg-text landing_body">Veg</span>
                          </div>
                        </div>
                      </div>
                      <div className="food-card-footer">
                        Breakfast/Lunch/Dinner
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="category-empty-state" style={{ gridColumn: '1 / -1', padding: '24px', background: '#f9fafb', borderRadius: '8px', border: '1.5px dashed var(--border)', textAlign: 'center', fontSize: 'var(--label-size)', color: 'var(--text-muted)' }}>
                    No dishes in this category yet.
                  </div>
                )}
              </div>
            </section>
          ))
        ) : (
          <div className="empty-state">
            <h4 className="empty-state-title">No menu items found</h4>
            <p className="empty-state-desc">Try search terms or adjust the veg/non-veg filters.</p>
          </div>
        )
      ) : (
        /* Empty State: Import Menu */
        <div className="import-menu-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', background: 'var(--bg-white)', borderRadius: '12px', padding: '40px', marginTop: '20px' }}>
          <button 
            type="button" 
            onClick={() => setIsImportModalOpen(true)}
            style={{
              padding: '16px 32px',
              background: '#EF5C43',
              color: 'var(--bg-white)',
              border: 'none',
              borderRadius: '6px',
              fontSize: 'var(--body-large-size)',
              fontWeight: 'var(--weight-bold)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(239, 92, 67, 0.2)',
              transition: 'transform 0.15s, background-color 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e04f36'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#EF5C43'}
          >
            Import menu
          </button>
        </div>
      )}

      {selectionCategoryId !== null ? (
        <div style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 100, display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={handleCancelSelection}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '25px',
              backgroundColor: 'var(--border)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              fontSize: 'var(--body-large-size)',
              fontWeight: 'var(--weight-bold)',
              color: '#374151'
            }}
            title="Cancel Selection"
          >
            ✕
          </button>
          
          <button
            type="button"
            onClick={handleDeleteSelectedDishes}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '25px',
              backgroundColor: '#EF5C43',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              opacity: selectedDishIds.length === 0 ? 0.6 : 1
            }}
            title="Delete Selected Dishes"
            disabled={selectedDishIds.length === 0}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      ) : (
        /* Floating Action Button (FAB) toggles Options Menu */
        <div ref={fabRef} style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 100 }}>
          {isFabMenuOpen && (
            <div className="fab-options-menu">
              <button
                type="button"
                className="fab-option-item"
                onClick={() => {
                  setIsCategoryModalOpen(true);
                  setIsFabMenuOpen(false);
                }}
              >
                Category
              </button>
              <button
                type="button"
                className="fab-option-item"
                onClick={() => {
                  setNewItemCategory(categories[0]?.id || 'biriyani');
                  setIsModalOpen(true);
                  setIsFabMenuOpen(false);
                }}
              >
                Item
              </button>
            </div>
          )}

          <button
            className="fab-img-btn-toggle"
            onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
            title="Add Action"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'block',
              transition: 'transform 0.2s'
            }}
          >
            {isFabMenuOpen ? (
              <div className="close-fab-icon">
                <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="50" height="50" rx="25" fill="#EF5C43" />
                  <path d="M18 18L32 32M32 18L18 32" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              <img src={addBtnIcon} alt="Add Action" style={{ width: '50px', height: '50px', display: 'block' }} />
            )}
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content dish-modal-content">
            <div className="modal-header dish-modal-header">
              <h3 className="modal-title dish-modal-title landing_heading2">Add new dish</h3>
            </div>

            <form onSubmit={handleAddItemSubmit} className="dish-modal-form">
              {/* Row 1: Dish name & Pricing */}
              <div className="dish-form-grid-row">
                <div className="dish-form-group">
                  <label className="dish-label landing_body">Dish name</label>
                  <input
                    type="text"
                    className="dish-input landing_placeholder"
                    placeholder="Enter dish name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                </div>

                <div className="dish-form-group">
                  <label className="dish-label landing_body">Pricing</label>
                  <div className="pricing-input-wrapper">
                    <input
                      type="number"
                      className="dish-input pricing-input landing_placeholder"
                      placeholder="0"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      required
                    />
                    <span className="currency-symbol landing_body">₹</span>
                  </div>
                  <span className="pricing-helper landing_body">You can change the currency symbol at the restaurant setting page</span>
                </div>
              </div>

              {/* Row 2: Availability & Dish type */}
              <div className="dish-form-grid-row" style={{ marginTop: '24px' }}>
                <div className="dish-form-group">
                  <label className="dish-label">Availability</label>
                  <div className="availability-checkbox-group">
                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={availBreakfast}
                        onChange={(e) => setAvailBreakfast(e.target.checked)}
                        className="offer-row-checkbox"
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Breakfast</span>
                    </label>

                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={availDinner}
                        onChange={(e) => setAvailDinner(e.target.checked)}
                        className="offer-row-checkbox"
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Dinner</span>
                    </label>

                    <label className="availability-check-label">
                      <input
                        type="checkbox"
                        checked={availLunch}
                        onChange={(e) => setAvailLunch(e.target.checked)}
                        className="offer-row-checkbox"
                      />
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Lunch</span>
                    </label>
                  </div>
                </div>

                <div className="dish-form-group">
                  <label className="dish-label">Dish type</label>
                  <div className="dish-type-radio-group">
                    <label className="dish-radio-label">
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Veg</span>
                      <input
                        type="radio"
                        name="dishType"
                        checked={newItemIsVeg === true}
                        onChange={() => setNewItemIsVeg(true)}
                        className="dish-radio-input"
                      />
                      <span className="dish-radio-dot"></span>
                    </label>

                    <label className="dish-radio-label" style={{ marginLeft: '12px' }}>
                      <span style={{ fontSize: 'var(--label-size)', color: 'var(--text-dark)', fontWeight: 'var(--weight-medium)' }}>Non Veg</span>
                      <input
                        type="radio"
                        name="dishType"
                        checked={newItemIsVeg === false}
                        onChange={() => setNewItemIsVeg(false)}
                        className="dish-radio-input"
                      />
                      <span className="dish-radio-dot"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 3: Upload image & Category select */}
              <div className="dish-form-grid-row" style={{ marginTop: '24px' }}>
                <div className="dish-form-group">
                  <label className="dish-label">Upload image</label>
                  <div className="dish-file-upload">
                    <label className="file-upload-btn-label">
                      Choose image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <span className="file-upload-name-text">{fileName || 'No file chosen'}</span>
                  </div>
                </div>

                <div className="dish-form-group">
                  <label className="dish-label">Category</label>
                  <select
                    className="dish-select"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Footer Save & Cancel Buttons */}
              <div className="dish-modal-footer">
                <button type="submit" className="btn-save-dish">Save dish</button>
                <button type="button" className="btn-cancel-dish" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="category-modal-content">
            <div className="category-modal-header">
              <h3 className="category-modal-title">Create category</h3>
            </div>

            <form onSubmit={handleAddCategorySubmit} className="category-modal-form">
              <div className="category-form-group">
                <label className="category-label">Category name</label>
                <input
                  type="text"
                  className="category-input"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  required
                />
              </div>

              <div className="category-modal-footer">
                <button type="submit" className="btn-create-category">Create</button>
                <button type="button" className="btn-cancel-category" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', padding: '24px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 className="modal-title" style={{ fontSize: 'var(--body-large-size)', fontWeight: 'var(--weight-bold)', color: 'var(--text-dark)' }}>Import Menu from Excel/CSV</h3>
              <button className="modal-close-btn" style={{ fontSize: 'var(--section-title-size)', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }} onClick={() => setIsImportModalOpen(false)}>×</button>
            </div>

            <div style={{ marginTop: '16px', fontSize: 'var(--body-small-size)', color: '#374151', lineHeight: '1.6' }}>
              <p style={{ fontWeight: 'var(--weight-semibold)', marginBottom: '8px' }}>Instructions:</p>
              <ol style={{ paddingLeft: '20px', margin: '0 0 16px 0', color: '#4b5563' }}>
                <li>Download the Excel template using the button below.</li>
                <li>Add your menu details, ensuring columns are formatted correctly.</li>
                <li>Save the completed file as a <strong>.csv</strong> file.</li>
                <li>Click "Choose CSV File" to select and import your menu.</li>
              </ol>

              <button
                type="button"
                onClick={downloadTemplate}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#EF5C43',
                  color: 'var(--bg-white)',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'var(--weight-semibold)',
                  cursor: 'pointer',
                  marginBottom: '20px',
                  boxShadow: '0 4px 6px -1px rgba(239, 92, 67, 0.1)',
                  transition: 'background-color 0.15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e04f36'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#EF5C43'}
              >
                Download Excel/CSV Template
              </button>

              <div style={{ border: '2px dashed #d1d5db', padding: '24px', borderRadius: '8px', textAlign: 'center', background: '#f9fafb' }}>
                <label className="file-upload-btn-label" style={{ display: 'inline-block', padding: '10px 20px', background: '#EF5C43', color: 'var(--bg-white)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'var(--weight-semibold)', boxShadow: '0 2px 4px rgba(239, 92, 67, 0.1)' }}>
                  Choose CSV File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Filter Modal Dialog */}
      {isFilterModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFilterModalOpen(false)}>
          <div className="filter-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <h3 className="filter-modal-title">Filter</h3>
            </div>

            <div className="filter-modal-body">
              <form onSubmit={handleApplyFilters}>
                {/* Category Dropdown */}
                <div className="filter-group">
                  <label className="filter-label">Category</label>
                  <div className="filter-select-wrapper">
                    <select 
                      className="filter-select"
                      value={tempFilterCategory}
                      onChange={(e) => setTempFilterCategory(e.target.value)}
                    >
                      <option value="all">Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Availability Checkboxes */}
                <div className="filter-group" style={{ marginTop: '20px' }}>
                  <label className="filter-label">Availability</label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="checkbox" 
                        className="filter-checkbox-input"
                        checked={tempFilterAvailability.Breakfast}
                        onChange={(e) => setTempFilterAvailability(prev => ({ ...prev, Breakfast: e.target.checked }))}
                      />
                      Breakfast
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="checkbox" 
                        className="filter-checkbox-input"
                        checked={tempFilterAvailability.Dinner}
                        onChange={(e) => setTempFilterAvailability(prev => ({ ...prev, Dinner: e.target.checked }))}
                      />
                      Dinner
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="checkbox" 
                        className="filter-checkbox-input"
                        checked={tempFilterAvailability.Lunch}
                        onChange={(e) => setTempFilterAvailability(prev => ({ ...prev, Lunch: e.target.checked }))}
                      />
                      Lunch
                    </label>
                  </div>
                </div>

                {/* Dish Type Radios */}
                <div className="filter-group" style={{ marginTop: '20px' }}>
                  <label className="filter-label">Dish type</label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="radio" 
                        name="dishType"
                        className="filter-radio-input"
                        checked={tempFilterDishType === 'veg'}
                        onChange={() => setTempFilterDishType('veg')}
                      />
                      Veg
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="radio" 
                        name="dishType"
                        className="filter-radio-input"
                        checked={tempFilterDishType === 'non-veg'}
                        onChange={() => setTempFilterDishType('non-veg')}
                      />
                      Non Veg
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--label-size)', fontWeight: 'var(--weight-medium)', color: 'var(--text-dark)' }}>
                      <input 
                        type="radio" 
                        name="dishType"
                        className="filter-radio-input"
                        checked={tempFilterDishType === 'all'}
                        onChange={() => setTempFilterDishType('all')}
                      />
                      All
                    </label>
                  </div>
                </div>

                {/* Buttons Row */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                  <button type="submit" className="filter-submit-btn">Filter</button>
                  <button type="button" className="filter-cancel-btn" onClick={() => setIsFilterModalOpen(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MenuList;
