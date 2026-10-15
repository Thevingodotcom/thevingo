import React from 'react';
import { comboAnchorId, formatPrice, formatTiming, formatValidTill } from './offerDisplay';

// Small % tag glyph, echoing the red tag badge owners pick on the Offers page.
const TagIcon = () => (
  <svg className="pm-offer-badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

/** Text-first badge (never color-only); `style` picks the look matching the owner's badge choice. */
export const OfferBadge = ({ style, children }) => (
  <span className={`pm-offer-badge pm-offer-badge--${style}`}>
    {style === 'discount' && <TagIcon />}
    {style === 'weekend' && <span className="pm-offer-badge-prefix">Weekend</span>}
    <span>{children}</span>
  </span>
);

const VegMarker = ({ isVeg }) => (
  <span className={`public-veg-box pm-veg-box ${!isVeg ? 'non-veg' : ''}`} aria-hidden="true">
    <span className={`public-veg-dot ${!isVeg ? 'non-veg' : ''}`}></span>
  </span>
);

/** Price block of a dish card that has an active discount offer. */
export const DishOfferPrice = ({ offer }) => (
  <div className="pm-dish-offer">
    <div className="pm-offer-tagline">
      <OfferBadge style={offer.style}>{offer.label}</OfferBadge>
      {offer.title && <span className="pm-offer-title landing_body" title={offer.title}>{offer.title}</span>}
    </div>
    <p className="public-food-price landing_body pm-price">
      <span className="pm-price-now">
        <span className="pm-sr-only">Offer price: </span>{formatPrice(offer.offerPrice)} Rs
      </span>
      <s className="pm-price-was">
        <span className="pm-sr-only">Original price: </span>{formatPrice(offer.originalPrice)} Rs
      </s>
    </p>
    {offer.savings > 0 && (
      <span className="pm-save landing_body">Save {formatPrice(offer.savings)} Rs</span>
    )}
  </div>
);

/** "Part of a combo" chip on a dish card; jumps to the (first) combo card. */
export const ComboChip = ({ combos, onJump }) => {
  if (!combos || combos.length === 0) return null;
  const first = combos[0];
  const text = combos.length > 1 ? `Part of ${combos.length} combos` : 'Part of a combo';
  return (
    <button
      type="button"
      className="pm-combo-chip landing_body"
      onClick={() => onJump(first.id)}
      aria-label={`${text}: show ${first.title}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 6.5h3.5V10M10 17.5H6.5V14" />
      </svg>
      {text}
    </button>
  );
};

const comboBadgeText = (style) => {
  if (style === 'weekend') return 'Combo';
  if (style === 'discount') return 'Combo deal';
  return 'Combo offer';
};

const ComboCard = ({ combo, highlighted }) => {
  const validTill = formatValidTill(combo.endDate);
  const timing = formatTiming(combo.timing);
  const titleId = `${comboAnchorId(combo.id)}-title`;
  return (
    <article
      id={comboAnchorId(combo.id)}
      className={`pm-combo-card ${highlighted ? 'is-highlighted' : ''}`}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid="public-combo-card"
    >
      <div className="pm-combo-body">
        <div className="pm-combo-head">
          <OfferBadge style={combo.style}>{comboBadgeText(combo.style)}</OfferBadge>
          <h4 id={titleId} className="pm-combo-title landing_body">{combo.title}</h4>
        </div>

        <ul className="pm-combo-dishes" aria-label="Included dishes">
          {combo.dishes.map((dish, index) => (
            <li key={dish.id || index} className="pm-combo-dish landing_body">
              {dish.isVeg !== null && <VegMarker isVeg={dish.isVeg} />}
              <span className="pm-combo-dish-name">{dish.name}</span>
              {dish.isVeg !== null && <span className="pm-sr-only"> ({dish.isVeg ? 'Veg' : 'Non Veg'})</span>}
            </li>
          ))}
        </ul>

        <div className="pm-combo-pricing">
          <p className="pm-price pm-combo-price-row landing_body">
            <span className="pm-price-now pm-combo-price">
              <span className="pm-sr-only">Combo price: </span>{formatPrice(combo.comboPrice)} Rs
            </span>
            {combo.originalTotal !== null && (
              <s className="pm-price-was">
                <span className="pm-sr-only">Original total: </span>{formatPrice(combo.originalTotal)} Rs
              </s>
            )}
          </p>
          {combo.savings > 0 && (
            <span className="pm-save landing_body">Save {formatPrice(combo.savings)} Rs</span>
          )}
        </div>
      </div>

      {(validTill || timing) && (
        <div className="pm-combo-footer landing_body">
          {validTill && <span>Valid till {validTill}</span>}
          {timing && <span>{timing}</span>}
        </div>
      )}
    </article>
  );
};

/** "Combo offers" section shown above the categories; renders nothing without combos. */
export const ComboOffersSection = ({ combos, highlightedId }) => {
  if (!combos || combos.length === 0) return null;
  return (
    <section className="public-category-section pm-combos" aria-labelledby="public-combos-title">
      <h3 id="public-combos-title" className="public-category-title landing_heading2">Combo offers</h3>
      <div className="pm-combo-grid">
        {combos.map(combo => (
          <ComboCard key={combo.id} combo={combo} highlighted={combo.id === highlightedId} />
        ))}
      </div>
    </section>
  );
};
