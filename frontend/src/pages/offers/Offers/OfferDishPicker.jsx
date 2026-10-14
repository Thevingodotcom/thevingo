import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice, percentageOfferPrice, parseAmount } from '../../../utils/offerPricing';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7"></circle>
    <line x1="20" y1="20" x2="16.05" y2="16.05"></line>
  </svg>
);

const CloseSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12"></path>
  </svg>
);

// Checkbox that can show the "some selected" state (select-all per category)
const CategoryCheckbox = ({ checked, indeterminate, onChange, label }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="offer-row-checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  );
};

/**
 * Searchable, category-grouped dish selector for the offer form.
 * mode: 'percentage' | 'fixed' | 'combo'
 */
function OfferDishPicker({
  categories,
  selectedIds,
  onChange,
  mode,
  discountPercentage,
  fixedPrices,
  onFixedPriceChange,
  fixedErrors
}) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (Array.isArray(categories) ? categories : [])
      .map(cat => {
        const items = (Array.isArray(cat?.items) ? cat.items : []).filter(item => item?.id != null);
        const categoryMatches = q && String(cat?.name || '').toLowerCase().includes(q);
        return {
          id: String(cat.id),
          name: cat.name,
          items: q && !categoryMatches
            ? items.filter(item => String(item.name || '').toLowerCase().includes(q))
            : items
        };
      })
      .filter(group => group.items.length > 0);
  }, [categories, query]);

  const totalDishes = (Array.isArray(categories) ? categories : [])
    .reduce((sum, cat) => sum + (Array.isArray(cat?.items) ? cat.items.length : 0), 0);

  const pct = parseAmount(discountPercentage);
  const pctValid = mode === 'percentage' && !pct.error && pct.value > 0 && pct.value < 100;

  const toggleDish = (id) => {
    const next = selected.has(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onChange(next);
  };

  const toggleGroup = (group) => {
    const ids = group.items.map(item => String(item.id));
    const allSelected = ids.every(id => selected.has(id));
    if (allSelected) {
      onChange(selectedIds.filter(id => !ids.includes(id)));
    } else {
      onChange([...selectedIds, ...ids.filter(id => !selected.has(id))]);
    }
  };

  return (
    <div className="offer-dish-picker">
      <div className="offer-dish-picker-head">
        <span className="offer-dish-count landing_body" aria-live="polite">
          {selectedIds.length} selected
        </span>
        {selectedIds.length > 0 && (
          <button type="button" className="offer-link-btn" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>

      {totalDishes === 0 ? (
        <p className="offer-dish-empty landing_body">
          No dishes on your menu yet. Add dishes in Kitchen menu first.
        </p>
      ) : (
        <>
          <div className="offer-dish-search">
            <span className="offer-dish-search-icon"><SearchIcon /></span>
            <input
              type="text"
              className="offer-dish-search-input landing_placeholder"
              placeholder="Search dishes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuery('');
                }
                if (e.key === 'Enter') e.preventDefault();
              }}
              aria-label="Search dishes"
            />
            {query && (
              <button
                type="button"
                className="offer-dish-search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear dish search"
              >
                <CloseSmallIcon />
              </button>
            )}
          </div>

          <div className="offer-dish-list" role="group" aria-label="Dishes">
            {groups.length === 0 && (
              <p className="offer-dish-empty landing_body">No dishes match "{query.trim()}".</p>
            )}
            {groups.map(group => {
              const ids = group.items.map(item => String(item.id));
              const selectedInGroup = ids.filter(id => selected.has(id)).length;
              return (
                <div key={group.id} className="offer-dish-group">
                  <label className="offer-dish-group-head">
                    <CategoryCheckbox
                      checked={selectedInGroup === ids.length}
                      indeterminate={selectedInGroup > 0 && selectedInGroup < ids.length}
                      onChange={() => toggleGroup(group)}
                      label={`Select all in ${group.name}`}
                    />
                    <span className="offer-dish-group-name">{group.name}</span>
                    <span className="offer-dish-group-count">{selectedInGroup}/{ids.length}</span>
                  </label>

                  {group.items.map(item => {
                    const id = String(item.id);
                    const isSelected = selected.has(id);
                    const fixedError = isSelected && mode === 'fixed' ? fixedErrors?.[id] : null;
                    return (
                      <div key={id} className={`offer-dish-row ${isSelected ? 'is-selected' : ''}`}>
                        <label className="offer-dish-main">
                          <input
                            type="checkbox"
                            className="offer-row-checkbox"
                            checked={isSelected}
                            onChange={() => toggleDish(id)}
                            aria-label={item.name}
                          />
                          {typeof item.isVeg === 'boolean' && (
                            <span
                              className={`offer-veg-dot ${item.isVeg ? 'veg' : 'non-veg'}`}
                              title={item.isVeg ? 'Veg' : 'Non-veg'}
                              aria-hidden="true"
                            ></span>
                          )}
                          <span className="offer-dish-name">{item.name}</span>
                          <span className={`offer-dish-price ${isSelected && pctValid ? 'is-struck' : ''}`}>
                            {formatPrice(item.price)}
                          </span>
                          {isSelected && pctValid && (
                            <span className="offer-dish-new-price">
                              {formatPrice(percentageOfferPrice(item.price, pct.value))}
                            </span>
                          )}
                        </label>

                        {isSelected && mode === 'fixed' && (
                          <div className="offer-dish-fixed">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`form-input offer-dish-fixed-input landing_placeholder ${fixedError ? 'has-error' : ''}`}
                              placeholder="Offer price"
                              value={fixedPrices?.[id] ?? ''}
                              onChange={(e) => onFixedPriceChange(id, e.target.value)}
                              aria-label={`Offer price for ${item.name}`}
                              aria-invalid={fixedError ? 'true' : undefined}
                            />
                            {fixedError && <span className="offer-field-error" role="alert">{fixedError}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default OfferDishPicker;
