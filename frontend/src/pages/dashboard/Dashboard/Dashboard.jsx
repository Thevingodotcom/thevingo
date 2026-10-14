import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { haptics } from '../../../utils/haptics';
import './Dashboard.css';

// Custom inline SVG icons for dashboard circles
const PercentBadgeIcon = () => (
  <span style={{ fontSize: 'var(--body-large-size)', fontWeight: 'var(--weight-extrabold)', fontFamily: 'sans-serif' }}>%</span>
);

const QRBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 3h3v3h-3v-3zm3 3h3v2h-3v-2zm-3-3h-2v2h2v-2zm6-3h-2v2h2v-2z" />
  </svg>
);

const DishBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 1 6 6v1H6V9a6 6 0 0 1 6-6z" fill="currentColor" />
    <line x1="2" y1="14" x2="22" y2="14" strokeWidth="2.5" />
    <path d="M5 14v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" fill="currentColor" />
    <circle cx="12" cy="2" r="1.2" fill="currentColor" />
  </svg>
);

const CategoryBadgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const ChevronIcon = () => (
  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 9L5 5L1 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);


// GET /api/offers returns { isActive: boolean, status: 'Active' | 'Inactive', effectiveStatus }.
// effectiveStatus also accounts for the offer's dates (scheduled / expired), so prefer it;
// fall back to the on/off toggle for responses that don't include it.
const isOfferActive = (offer) => {
  if (offer?.effectiveStatus) return offer.effectiveStatus === 'active';
  return offer?.isActive === true || String(offer?.status || '').toLowerCase() === 'active';
};

function Dashboard({ categories, offers, scanCount, isDataLoading, onRefresh }) {
  const navigate = useNavigate();

  // Re-sync counts with the server whenever the dashboard is opened (App throttles this)
  useEffect(() => {
    if (onRefresh) onRefresh();
  }, [onRefresh]);

  // Compute stats synchronously from memory - completely eliminates loading delays when switching tabs
  const activeOffers = Array.isArray(offers) ? offers.filter(isOfferActive).length : 0;
  const categoryCount = Array.isArray(categories) ? categories.length : 0;
  const dishCount = Array.isArray(categories)
    ? categories.reduce((total, cat) => total + (Array.isArray(cat?.items) ? cat.items.length : 0), 0)
    : 0;

  const cards = [
    { key: 'offers', label: 'Active offer', count: activeOffers, Icon: PercentBadgeIcon, to: '/dashboard/offers', destination: 'Offers' },
    { key: 'scans', label: 'Total Scan', count: scanCount ?? 0, Icon: QRBadgeIcon, to: '/dashboard/distribution', destination: 'Distribution' },
    { key: 'dishes', label: 'Dish', count: dishCount, Icon: DishBadgeIcon, to: '/dashboard/kitchen-menu', destination: 'Kitchen menu' },
    { key: 'categories', label: 'Category', count: categoryCount, Icon: CategoryBadgeIcon, to: '/dashboard/kitchen-menu', destination: 'Kitchen menu' }
  ];

  return (
    <div className="dashboard-page-container">
      <h2 className="landing_heading2" style={{ color: 'var(--text-dark)', margin: '0 0 24px 0' }}>Dashboard</h2>

      {/* Stats Cards Grid Layout - each card opens the page that manages it */}
      <div className="dash-stats-grid">
        {cards.map(({ key, label, count, Icon, to, destination }) => (
          <button
            key={key}
            type="button"
            className="dash-stat-card dash-stat-card--link"
            onClick={() => {
              haptics.selection();
              navigate(to);
            }}
            aria-label={`${label}: ${isDataLoading ? 'loading' : count}. Open ${destination}`}
          >
            <span className="dash-card-left">
              <span className="dash-card-icon-badge">
                <Icon />
              </span>
              <span className="dash-card-text">
                <span className="dash-card-count landing_body2">{isDataLoading ? '...' : count}</span>
                <span className="dash-card-label landing_body">{label}</span>
              </span>
            </span>
            <span className="dash-card-right" aria-hidden="true">
              <ChevronIcon />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
